import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TILE = 256;
const MAX_FLOOR = 15;
const MAX_COORD = 65535;
const COLOR_NAME = /^Minimap_Color_(\d{1,5})_(\d{1,5})_(\d{1,2})\.png$/;

export function parseColorName(base) {
    const match = COLOR_NAME.exec(base);
    if (!match) {
        return null;
    }
    const x = Number(match[1]);
    const y = Number(match[2]);
    const z = Number(match[3]);
    if (x > MAX_COORD || y > MAX_COORD || z > MAX_FLOOR || x % TILE !== 0 || y % TILE !== 0) {
        return null;
    }
    return { x, y, z, base: "Minimap_Color_" + x + "_" + y + "_" + z + ".png" };
}

export function inspectPng(buf) {
    if (!buf || buf.length < 24) {
        return null;
    }
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < signature.length; i += 1) {
        if (buf[i] !== signature[i]) {
            return null;
        }
    }
    if (buf.toString("ascii", 12, 16) !== "IHDR") {
        return null;
    }
    if (buf.indexOf("IEND") === -1) {
        return null;
    }
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function insideRoot(root, candidate) {
    const realRoot = fs.realpathSync(root);
    const realCandidate = fs.realpathSync(candidate);
    return realCandidate === realRoot || realCandidate.startsWith(realRoot + path.sep);
}

function listColorFiles(dir) {
    const found = [];
    const stack = [dir];
    while (stack.length) {
        const current = stack.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (!insideRoot(dir, full)) {
                continue;
            }
            if (entry.isDirectory()) {
                stack.push(full);
                continue;
            }
            if (!entry.isFile()) {
                continue;
            }
            const parsed = parseColorName(entry.name);
            if (parsed) {
                found.push({ ...parsed, full });
            }
        }
    }
    return found;
}

function openSource(source) {
    const stat = fs.statSync(source);
    if (stat.isDirectory()) {
        return { dir: source, cleanup: function () {} };
    }
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tibiawiki-minimap-"));
    execFileSync("unzip", ["-o", "-q", source, "-d", temp], { stdio: "inherit" });
    return {
        dir: temp,
        cleanup: function () {
            fs.rmSync(temp, { recursive: true, force: true });
        }
    };
}

export function importMinimap(source, dest) {
    const opened = openSource(path.resolve(source));
    const summary = { added: 0, replaced: 0, skipped: 0 };
    try {
        fs.mkdirSync(dest, { recursive: true });
        for (const file of listColorFiles(opened.dir)) {
            const buf = fs.readFileSync(file.full);
            const size = inspectPng(buf);
            if (!size || size.width !== TILE || size.height !== TILE) {
                summary.skipped += 1;
                continue;
            }
            const target = path.join(dest, file.base);
            const exists = fs.existsSync(target);
            fs.copyFileSync(file.full, target);
            if (exists) {
                summary.replaced += 1;
            } else {
                summary.added += 1;
            }
        }
        const names = fs.readdirSync(dest)
            .map(parseColorName)
            .filter(Boolean)
            .map(function (file) { return file.x + "_" + file.y + "_" + file.z; })
            .sort(function (a, b) {
                const left = a.split("_").map(Number);
                const right = b.split("_").map(Number);
                return left[2] - right[2] || left[1] - right[1] || left[0] - right[0];
            });
        fs.writeFileSync(path.join(dest, "tiles.json"), JSON.stringify(names));
        fs.writeFileSync(path.join(dest, "versao.txt"), new Date().toISOString() + "\n");
        summary.tiles = names.length;
        return summary;
    } finally {
        opened.cleanup();
    }
}

function main() {
    const source = process.argv[2];
    const dest = process.argv[3];
    if (!source || !dest) {
        console.error("Uso: node Mapa/import-minimap.mjs <pasta-ou-zip> <destino>");
        process.exit(1);
    }
    const summary = importMinimap(source, dest);
    console.log(
        "Entraram " + summary.added +
        ", substituíram " + summary.replaced +
        ", ignorados " + summary.skipped +
        ", índice " + summary.tiles + " blocos."
    );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
