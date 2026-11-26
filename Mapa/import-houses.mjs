/* Monta o houses.json do mapa: a porta de cada casa, no formato que o mapa.js lê. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_FLOOR = 15;

export function entranceOf(filePath) {
    let data;
    try {
        data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
        return null;
    }
    if (!data || data.format !== "umanthir.house.v1" || !data.house || !data.house.entrance) {
        return null;
    }
    const at = data.house.entrance;
    const x = at.x;
    const y = at.y;
    const z = at.z;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) || z < 0 || z > MAX_FLOOR) {
        return null;
    }
    return { slug: path.basename(filePath, ".json"), x: x, y: y, z: z };
}

export function importHouses(source) {
    const files = [];
    function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.name.endsWith(".json")) {
                files.push(full);
            }
        }
    }
    walk(source);
    const houses = {};
    let skipped = 0;
    for (const file of files) {
        const house = entranceOf(file);
        if (!house) {
            skipped += 1;
            continue;
        }
        houses[house.slug] = [house.x, house.y, house.z];
    }
    const slugs = Object.keys(houses).sort();
    const out = {};
    for (const slug of slugs) {
        out[slug] = houses[slug];
    }
    return { houses: out, count: slugs.length, skipped: skipped };
}

function main() {
    const source = process.argv[2];
    const dest = process.argv[3];
    if (!source || !dest) {
        console.error("Uso: node Mapa/import-houses.mjs <pasta-das-casas> <houses.json>");
        process.exit(1);
    }
    const summary = importHouses(source);
    fs.writeFileSync(dest, JSON.stringify(summary.houses));
    fs.writeFileSync(path.join(path.dirname(dest), "versao.txt"), new Date().toISOString() + "\n");
    console.log("Portas " + summary.count + ", ignorados " + summary.skipped + ".");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
