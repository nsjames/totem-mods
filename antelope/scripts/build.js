#!/usr/bin/env node

const { exec } = require("child_process");
const {
    readdirSync,
    statSync,
    existsSync,
    mkdirSync,
} = require("fs");
const path = require("path");

function run(cmd, options = {}) {
    return new Promise((resolve, reject) => {
        exec(cmd, { ...options, shell: true }, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                return reject(error);
            }
            resolve({ stdout, stderr });
        });
    });
}

(async () => {
    let HAS_LOCAL_CDT = false;

    try {
        const res = await run("cdt-cpp -v");
        HAS_LOCAL_CDT = res.stderr.length === 0;
    } catch {}

    console.log(`Using ${HAS_LOCAL_CDT ? "local" : "dockerized"} CDT compiler`);

    async function buildContract(contractDir, contractName, outputDir) {
        console.log(`Building: ${contractName}`);

        const absContractDir = path.resolve(contractDir);
        const absOutputDir = path.resolve(outputDir);

        const cppFile = `${absContractDir}/${contractName}.cpp`;
        const wasmOut = `${absOutputDir}/${contractName}.wasm`;
        const abiOut  = `${absOutputDir}/${contractName}.abi`;

        try {
            if (HAS_LOCAL_CDT) {
                await run(
                    `cdt-cpp ${cppFile} -o ${wasmOut} ` +
                    `-I ${absContractDir}/include -I contracts/library --abigen`
                );
            } else {
                const dockerCmd = `
docker run --rm \
-v ${process.cwd()}:/work \
-w /work \
cdt-builder \
bash -c "mkdir -p /work/build && \
cdt-cpp ${contractDir}/${contractName}.cpp \
-o /work/build/${contractName}.wasm \
-I ${contractDir}/include \
-I contracts/library \
--abigen"
                `.trim().replace(/\s+/g, " ");

                await run(dockerCmd);
            }

            if (!existsSync(wasmOut) || !existsSync(abiOut)) {
                throw new Error("Build finished but output missing");
            }

            console.log(`✅ Success: ${contractName}`);
        } catch (err) {
            console.error(`❌ Failed: ${contractName}`);
            throw err;
        }
    }

    const cwd = process.cwd();
    const outputDir = path.join(cwd, "build");
    mkdirSync(outputDir, { recursive: true });

    if (!HAS_LOCAL_CDT) {
        const imageCheck = await run("docker images -q cdt-builder");
        if (!imageCheck.stdout.trim()) {
            await run("docker build -t cdt-builder .");
        }
    }

    const args = process.argv.slice(2);

    if (args.length === 2) {
        await buildContract(args[0], args[1], outputDir);
        process.exit(0);
    }

    const contractsRoot = path.join(cwd, "contracts");
    const tasks = [];

    for (const dir of readdirSync(contractsRoot)) {
        if (dir === "library") continue;

        const fullDir = path.join(contractsRoot, dir);
        if (!statSync(fullDir).isDirectory()) continue;

        const files = readdirSync(fullDir).filter(f => f.endsWith(".cpp"));
        for (const file of files) {
            const contractName = path.basename(file, ".cpp");
            tasks.push(
                buildContract(`contracts/${dir}`, contractName, outputDir)
            );
        }
    }

    if (!tasks.length) {
        console.log("⚠️ No contracts found");
        process.exit(0);
    }

    console.log(`Building ${tasks.length} contracts...`);
    await Promise.all(tasks);

    console.log("All builds complete!");
})();
