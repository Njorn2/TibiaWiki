import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { importMinimap, inspectPng, parseColorName } from "./import-minimap.mjs";

function png(width, height) {
    const buffer = Buffer.alloc(33);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
    buffer.write("IHDR", 12, "ascii");
    buffer.writeUInt32BE(width, 16);
    buffer.writeUInt32BE(height, 20);
    buffer.write("IEND", 29, "ascii");
    return buffer;
}

test("aceita só Minimap_Color com coordenadas de bloco", function () {
    assert.deepEqual(parseColorName("Minimap_Color_32512_31488_7.png"), {
        x: 32512,
        y: 31488,
        z: 7,
        base: "Minimap_Color_32512_31488_7.png"
    });
    assert.equal(parseColorName("Minimap_WaypointCost_32512_31488_7.png"), null);
    assert.equal(parseColorName("Minimap_Color_32513_31488_7.png"), null);
    assert.equal(parseColorName("Minimap_Color_32512_31488_16.png"), null);
});

test("confere o tamanho do PNG pelo cabeçalho", function () {
    assert.deepEqual(inspectPng(png(256, 256)), { width: 256, height: 256 });
    assert.deepEqual(inspectPng(png(128, 256)), { width: 128, height: 256 });
    assert.equal(inspectPng(Buffer.from("não é png")), null);
});

test("junta os blocos e não leva o custo de caminho", function () {
    const source = fs.mkdtempSync(path.join(os.tmpdir(), "minimap-src-"));
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), "minimap-dst-"));
    fs.writeFileSync(path.join(source, "Minimap_Color_32512_31488_7.png"), png(256, 256));
    fs.writeFileSync(path.join(source, "Minimap_WaypointCost_32512_31488_7.png"), png(256, 256));
    fs.writeFileSync(path.join(source, "Minimap_Color_32768_31744_7.png"), png(128, 128));
    fs.writeFileSync(path.join(dest, "Minimap_Color_32512_31488_7.png"), png(256, 256));

    const first = importMinimap(source, dest);
    assert.equal(first.added, 0);
    assert.equal(first.replaced, 1);
    assert.equal(first.skipped, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dest, "tiles.json"), "utf8")), [
        "32512_31488_7"
    ]);

    fs.writeFileSync(path.join(source, "Minimap_Color_32768_31488_8.png"), png(256, 256));
    const second = importMinimap(source, dest);
    assert.equal(second.added, 1);
    assert.equal(second.tiles, 2);
});
