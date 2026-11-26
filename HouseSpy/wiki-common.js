/* HouseSpy. Acrescentar ao fim de MediaWiki:Common.js. */
(function () {
    var SDK_URL = "https://cdn.jsdelivr.net/npm/@umanthir/sdk@1.1.0/dist/umanthir.min.js";
    var SDK_SRI = "sha384-fGCgF4CT/VJAG38XkwYIDXPusa37MVw5oeZZJeZnjRoCRbQ5GeQkRdeGAHulD05Z";

    function whenReady(run) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", run);
            return;
        }
        run();
    }

    function loadSdk(run) {
        if (typeof Umanthir === "function") {
            run();
            return;
        }
        var tag = document.createElement("script");
        tag.src = SDK_URL;
        tag.integrity = SDK_SRI;
        tag.crossOrigin = "anonymous";
        tag.onload = run;
        tag.onerror = function () {
            document.querySelectorAll(".house-spy").forEach(function (root) {
                root.textContent = "Não foi possível carregar o SDK do Umanthir.";
            });
        };
        document.head.appendChild(tag);
    }

    whenReady(function () {
        if (!document.querySelector(".house-spy")) {
            return;
        }
        loadSdk(function () {
        (function () {
            var MAX_SCALE = 8;
            var client = typeof Umanthir === "function" ? new Umanthir() : null;


            function ensureStructure(root) {
                if (root.querySelector(".house-spy-canvas")) {
                    return;
                }
                root.setAttribute("role", "region");
                root.setAttribute("aria-label", "Visualizador de casa");
                root.innerHTML = "<div class=\"house-spy-bar\">\n        <p class=\"house-spy-name\">Casa</p>\n        <p class=\"house-spy-meta\">\n            <span class=\"house-spy-floor\" aria-live=\"polite\">Carregando a casa…</span>\n        </p>\n        <div class=\"house-spy-controls\">\n            <button type=\"button\" class=\"house-spy-up\">Subir</button>\n            <button type=\"button\" class=\"house-spy-down\">Descer</button>\n            <div class=\"house-spy-zoom-group\" role=\"group\" aria-label=\"Zoom\">\n                <button type=\"button\" class=\"house-spy-zoom-out\" aria-label=\"Diminuir zoom\">−</button>\n                <span class=\"house-spy-zoom\">100%</span>\n                <button type=\"button\" class=\"house-spy-zoom-in\" aria-label=\"Aumentar zoom\">+</button>\n                <button type=\"button\" class=\"house-spy-fit\">Ajustar</button>\n            </div>\n        </div>\n    </div>\n    <p class=\"house-spy-hint\">Arraste a planta para mover. A roda do mouse ou os botões ampliam e reduzem.</p>\n    <div class=\"house-spy-stage\" tabindex=\"0\" aria-label=\"Planta da casa. Arraste para mover.\">\n        <div class=\"house-spy-canvas\"></div>\n        <div class=\"house-spy-status\" role=\"status\"></div>\n    </div>\n    <div class=\"house-spy-floors\" role=\"tablist\" aria-label=\"Andares\" hidden></div>";
            }

            document.querySelectorAll(".house-spy").forEach(function (root) {
                if (root.getAttribute("data-ready") === "true") {
                    return;
                }
                ensureStructure(root);
                root.setAttribute("data-ready", "true");
                mount(root);
            });

            function mount(root) {
                var nameNode = root.querySelector(".house-spy-name");
                var floorNode = root.querySelector(".house-spy-floor");
                var upButton = root.querySelector(".house-spy-up");
                var downButton = root.querySelector(".house-spy-down");
                var zoomOutButton = root.querySelector(".house-spy-zoom-out");
                var zoomInButton = root.querySelector(".house-spy-zoom-in");
                var zoomNode = root.querySelector(".house-spy-zoom");
                var fitButton = root.querySelector(".house-spy-fit");
                var stage = root.querySelector(".house-spy-stage");
                var canvas = root.querySelector(".house-spy-canvas");
                var status = root.querySelector(".house-spy-status");
                var floorsNode = root.querySelector(".house-spy-floors");
                var state = {
                    slug: "",
                    name: "Casa",
                    floors: [],
                    index: 0,
                    surface: 7,
                    ground: 7,
                    step: { x: 32, y: 32 },
                    sizes: {},
                    urls: {},
                    pending: {},
                    scale: 1,
                    panX: 0,
                    panY: 0,
                    moved: false,
                    fitted: false,
                    token: 0,
                    drag: null
                };

                applySize(root);
                upButton.addEventListener("click", function () {
                    stepFloor(-1);
                });
                downButton.addEventListener("click", function () {
                    stepFloor(1);
                });
                zoomOutButton.addEventListener("click", function () {
                    zoomBy(1 / 1.25);
                });
                zoomInButton.addEventListener("click", function () {
                    zoomBy(1.25);
                });
                fitButton.addEventListener("click", function () {
                    state.moved = false;
                    fit();
                });
                stage.addEventListener("pointerdown", onPointerDown);
                stage.addEventListener("pointermove", onPointerMove);
                stage.addEventListener("pointerup", endDrag);
                stage.addEventListener("pointercancel", endDrag);
                stage.addEventListener("wheel", onWheel, { passive: false });
                stage.addEventListener("dblclick", function (event) {
                    event.preventDefault();
                    if (state.moved) {
                        state.moved = false;
                        fit();
                        return;
                    }
                    zoomAt(event.clientX, event.clientY, 2);
                });
                root.addEventListener("keydown", onKeyDown);
                if (typeof ResizeObserver === "function") {
                    var observer = new ResizeObserver(function () {
                        if (!state.moved) {
                            fit();
                        }
                    });
                    observer.observe(stage);
                }
                loadHouse();

                function loadHouse() {
                    state.token += 1;
                    var token = state.token;
                    state.slug = resolveSlug(root);
                    state.floors = [];
                    state.ground = 7;
                    state.fitted = false;
                    state.moved = false;
                    canvas.replaceChildren();
                    floorsNode.replaceChildren();
                    floorsNode.hidden = true;
                    upButton.hidden = true;
                    downButton.hidden = true;
                    setBusy(true);
                    if (!state.slug) {
                        showError("Informe a casa em data-house, ou abra o visualizador na página da casa.");
                        return;
                    }
                    if (!client) {
                        showError("Não foi possível carregar o SDK do Umanthir.");
                        return;
                    }
                    showStatus("Carregando a casa…", true);
                    client.wiki.house(state.slug).then(function (assembly) {
                        if (token !== state.token) {
                            return;
                        }
                        var floors = readFloors(assembly);
                        if (floors.length === 0) {
                            showError("Esta casa não tem andares publicados.");
                            return;
                        }
                        state.floors = floors;
                        state.name = readName(assembly, state.slug);
                        state.surface = readSurface(assembly);
                        state.ground = readGround(assembly);
                        state.step = readStep(assembly);
                        state.index = indexOfFloor(floors, initialFloor(root, floors, assembly));
                        nameNode.textContent = state.name;
                        renderFloorButtons();
                        showFloor(state.index, token);
                        floors.forEach(function (floor) {
                            if (floor.z !== state.floors[state.index].z) {
                                floorUrl(floor.z).catch(function () {});
                            }
                        });
                    }).catch(function (error) {
                        if (token !== state.token) {
                            return;
                        }
                        showLoadError(error);
                    });
                }

                function showFloor(index) {
                    var floor = state.floors[index];
                    if (!floor) {
                        return;
                    }
                    var slug = state.slug;
                    state.index = index;
                    var token = ++state.token;
                    updateChrome();
                    if (!state.urls[cacheKey(floor.z)]) {
                        showStatus("Carregando andar…", true);
                    }
                    revealFloor(floor, slug, token, true);
                    state.floors.slice(index + 1).forEach(function (below) {
                        revealFloor(below, slug, token, false);
                    });
                }

                function revealFloor(floor, slug, token, primary) {
                    floorUrl(floor.z).then(function (url) {
                        if (token !== state.token || slug !== state.slug) {
                            return;
                        }
                        var probe = new Image();
                        probe.onload = function () {
                            if (token !== state.token || slug !== state.slug) {
                                return;
                            }
                            state.sizes[cacheKey(floor.z)] = {
                                width: probe.naturalWidth,
                                height: probe.naturalHeight
                            };
                            syncLayers();
                            if (primary) {
                                if (!state.fitted) {
                                    fit();
                                } else {
                                    render();
                                }
                                hideStatus();
                                updateChrome();
                                return;
                            }
                            if (!state.moved) {
                                fit();
                            } else {
                                render();
                            }
                        };
                        probe.onerror = function () {
                            if (token !== state.token || !primary) {
                                return;
                            }
                            showError("Não foi possível ler a imagem deste andar.");
                        };
                        probe.src = url;
                    }).catch(function (error) {
                        if (token !== state.token || slug !== state.slug || !primary) {
                            return;
                        }
                        showLoadError(error);
                    });
                }

                function syncLayers() {
                    var top = state.floors[state.index];
                    var ordered = state.floors.slice(state.index).reverse();
                    var visible = {};
                    ordered.forEach(function (floor) {
                        var key = cacheKey(floor.z);
                        var url = state.urls[key];
                        if (!url || !state.sizes[key]) {
                            return;
                        }
                        visible[floor.z] = true;
                        var layer = canvas.querySelector('img[data-z="' + floor.z + '"]');
                        if (!layer) {
                            layer = document.createElement("img");
                            layer.className = "house-spy-image";
                            layer.draggable = false;
                            layer.alt = "";
                            layer.setAttribute("data-z", String(floor.z));
                        }
                        if (layer.getAttribute("src") !== url) {
                            layer.src = url;
                        }
                        var offset = offsetFor(floor.z);
                        layer.style.left = offset.x + "px";
                        layer.style.top = offset.y + "px";
                        layer.alt = floor === top
                            ? "Planta de " + state.name + ", " + floorLabel(floor).toLowerCase()
                            : "";
                        canvas.append(layer);
                    });
                    Array.prototype.forEach.call(canvas.querySelectorAll("img"), function (layer) {
                        if (!visible[layer.getAttribute("data-z")]) {
                            layer.remove();
                        }
                    });
                }

                function floorUrl(z) {
                    var slug = state.slug;
                    var key = slug + ":" + z;
                    if (state.urls[key]) {
                        return Promise.resolve(state.urls[key]);
                    }
                    if (state.pending[key]) {
                        return state.pending[key];
                    }
                    state.pending[key] = client.wiki.houseFloor(slug, z).then(function (bytes) {
                        var url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
                        if (slug === state.slug) {
                            state.urls[key] = url;
                        } else {
                            URL.revokeObjectURL(url);
                        }
                        delete state.pending[key];
                        return url;
                    }, function (error) {
                        delete state.pending[key];
                        throw error;
                    });
                    return state.pending[key];
                }

                function cacheKey(z) {
                    return state.slug + ":" + z;
                }

                function stepFloor(direction) {
                    var next = state.index + direction;
                    if (next < 0 || next >= state.floors.length) {
                        return;
                    }
                    showFloor(next);
                }

                function renderFloorButtons() {
                    floorsNode.replaceChildren();
                    var several = state.floors.length > 1;
                    floorsNode.hidden = !several;
                    upButton.hidden = !several;
                    downButton.hidden = !several;
                    floorButtonOrder().forEach(function (item) {
                        var button = document.createElement("button");
                        button.type = "button";
                        button.className = "house-spy-floor-button";
                        button.setAttribute("role", "tab");
                        button.dataset.index = String(item.index);
                        button.textContent = groundLabel(item.floor.z);
                        button.title = floorLabel(item.floor);
                        button.addEventListener("click", function () {
                            showFloor(item.index);
                        });
                        floorsNode.append(button);
                    });
                }

                function updateChrome() {
                    var floor = state.floors[state.index];
                    floorNode.textContent = floor
                        ? floorLabel(floor) + " · z " + floor.z + " · " + (state.index + 1) + " de " + state.floors.length
                        : "Sem andar";
                    upButton.disabled = state.index <= 0;
                    downButton.disabled = state.index < 0 || state.index >= state.floors.length - 1;
                    var buttons = floorsNode.querySelectorAll(".house-spy-floor-button");
                    buttons.forEach(function (button) {
                        var active = Number(button.dataset.index) === state.index;
                        button.classList.toggle("is-active", active);
                        button.setAttribute("aria-selected", active ? "true" : "false");
                        button.tabIndex = active ? 0 : -1;
                    });
                    stage.setAttribute("aria-label", floor
                        ? "Planta de " + state.name + ", " + floorLabel(floor) + ". Arraste para mover."
                        : "Planta da casa. Arraste para mover.");
                }

                function floorLabel(floor) {
                    var place = floor.place || "";
                    var match = /^(\d+)_(above|below)$/.exec(place);
                    if (place === "surface") {
                        return "Superfície";
                    }
                    if (match) {
                        return relativeLabel(Number(match[1]), match[2] === "above");
                    }
                    var delta = state.surface - floor.z;
                    if (delta === 0) {
                        return "Superfície";
                    }
                    return relativeLabel(Math.abs(delta), delta > 0);
                }

                function relativeLabel(count, above) {
                    var noun = count === 1 ? "andar" : "andares";
                    return count + " " + noun + (above ? " acima" : " abaixo");
                }

                function groundLabel(z) {
                    var delta = state.ground - z;
                    if (delta === 0) {
                        return "entrada";
                    }
                    return (delta > 0 ? "+" : "") + delta;
                }

                function floorButtonOrder() {
                    return state.floors.map(function (floor, index) {
                        return { floor: floor, index: index };
                    }).sort(function (a, b) {
                        return b.floor.z - a.floor.z;
                    });
                }

                function offsetFor(z) {
                    var anchor = state.floors[state.floors.length - 1];
                    if (!anchor) {
                        return { x: 0, y: 0 };
                    }
                    var levelsAbove = anchor.z - z;
                    return {
                        x: -levelsAbove * state.step.x,
                        y: -levelsAbove * state.step.y
                    };
                }

                function stackBounds() {
                    var left = Infinity;
                    var top = Infinity;
                    var right = -Infinity;
                    var bottom = -Infinity;
                    var any = false;
                    state.floors.slice(state.index).forEach(function (floor) {
                        var size = state.sizes[cacheKey(floor.z)];
                        if (!size) {
                            return;
                        }
                        var offset = offsetFor(floor.z);
                        any = true;
                        left = Math.min(left, offset.x);
                        top = Math.min(top, offset.y);
                        right = Math.max(right, offset.x + size.width);
                        bottom = Math.max(bottom, offset.y + size.height);
                    });
                    if (!any) {
                        return null;
                    }
                    return {
                        x: left,
                        y: top,
                        width: right - left,
                        height: bottom - top
                    };
                }

                function render() {
                    canvas.style.transform = "translate(" + state.panX + "px, " + state.panY + "px) scale(" + state.scale + ")";
                    zoomNode.textContent = Math.round(state.scale * 100) + "%";
                }

                function fit() {
                    var bounds = stackBounds();
                    var rect = stage.getBoundingClientRect();
                    if (!bounds || rect.width < 2 || rect.height < 2) {
                        return false;
                    }
                    var padding = 12;
                    var fitted = Math.min(
                        (rect.width - padding) / bounds.width,
                        (rect.height - padding) / bounds.height
                    );
                    var limits = scaleBounds(fitted);
                    state.scale = clamp(fitted, limits.min, limits.max);
                    state.panX = (rect.width - bounds.width * state.scale) / 2 - bounds.x * state.scale;
                    state.panY = (rect.height - bounds.height * state.scale) / 2 - bounds.y * state.scale;
                    state.fitted = true;
                    render();
                    return true;
                }

                function zoomBy(factor) {
                    var rect = stage.getBoundingClientRect();
                    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
                }

                function zoomAt(clientX, clientY, factor) {
                    var floor = state.floors[state.index];
                    var size = floor && state.sizes[cacheKey(floor.z)];
                    if (!size) {
                        return;
                    }
                    var rect = stage.getBoundingClientRect();
                    var offset = offsetFor(floor.z);
                    var px = clientX - rect.left;
                    var py = clientY - rect.top;
                    var originX = state.panX + offset.x * state.scale;
                    var originY = state.panY + offset.y * state.scale;
                    var localX = (px - originX) / state.scale;
                    var localY = (py - originY) / state.scale;
                    var fitted = Math.min(rect.width / size.width, rect.height / size.height);
                    var bounds = scaleBounds(fitted);
                    var next = clamp(state.scale * factor, bounds.min, bounds.max);
                    state.scale = next;
                    state.panX = px - offset.x * next - localX * next;
                    state.panY = py - offset.y * next - localY * next;
                    state.moved = true;
                    render();
                }

                function scaleBounds(fitted) {
                    var safeFit = Number.isFinite(fitted) && fitted > 0 ? fitted : 1;
                    return {
                        min: Math.max(0.05, Math.min(0.25, safeFit)),
                        max: Math.max(MAX_SCALE, safeFit)
                    };
                }

                function onPointerDown(event) {
                    if (event.button !== 0 || !state.sizes[cacheKey(currentZ())]) {
                        return;
                    }
                    state.drag = {
                        id: event.pointerId,
                        x: event.clientX,
                        y: event.clientY,
                        panX: state.panX,
                        panY: state.panY
                    };
                    stage.classList.add("is-panning");
                    stage.setPointerCapture(event.pointerId);
                }

                function onPointerMove(event) {
                    if (!state.drag || state.drag.id !== event.pointerId) {
                        return;
                    }
                    var dx = event.clientX - state.drag.x;
                    var dy = event.clientY - state.drag.y;
                    state.panX = state.drag.panX + dx;
                    state.panY = state.drag.panY + dy;
                    if (Math.abs(dx) + Math.abs(dy) >= 3) {
                        state.moved = true;
                    }
                    render();
                }

                function endDrag(event) {
                    if (!state.drag || state.drag.id !== event.pointerId) {
                        return;
                    }
                    state.drag = null;
                    stage.classList.remove("is-panning");
                }

                function onWheel(event) {
                    if (!state.sizes[cacheKey(currentZ())]) {
                        return;
                    }
                    event.preventDefault();
                    zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.15 : 1 / 1.15);
                }

                function onKeyDown(event) {
                    var target = event.target;
                    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
                        return;
                    }
                    if (event.key === "ArrowUp" || event.key === "PageUp") {
                        event.preventDefault();
                        stepFloor(-1);
                    } else if (event.key === "ArrowDown" || event.key === "PageDown") {
                        event.preventDefault();
                        stepFloor(1);
                    } else if (event.key === "+" || event.key === "=") {
                        event.preventDefault();
                        zoomBy(1.25);
                    } else if (event.key === "-" || event.key === "_") {
                        event.preventDefault();
                        zoomBy(1 / 1.25);
                    } else if (event.key === "0" || event.key === "Home") {
                        event.preventDefault();
                        state.moved = false;
                        fit();
                    }
                }

                function currentZ() {
                    var floor = state.floors[state.index];
                    return floor ? floor.z : null;
                }

                function setBusy(busy) {
                    upButton.disabled = busy;
                    downButton.disabled = busy;
                    zoomInButton.disabled = busy;
                    zoomOutButton.disabled = busy;
                    fitButton.disabled = busy;
                }

                function showStatus(message, spinner) {
                    status.classList.add("is-visible");
                    status.replaceChildren();
                    var card = document.createElement("div");
                    card.className = "house-spy-status-card";
                    if (spinner) {
                        var spin = document.createElement("div");
                        spin.className = "house-spy-spinner";
                        spin.setAttribute("aria-hidden", "true");
                        card.append(spin);
                    }
                    var paragraph = document.createElement("p");
                    paragraph.textContent = message;
                    card.append(paragraph);
                    status.append(card);
                    floorNode.textContent = message;
                }

                function hideStatus() {
                    status.classList.remove("is-visible");
                    status.replaceChildren();
                    setBusy(false);
                }

                function showError(message, action, actionLabel) {
                    setBusy(true);
                    zoomInButton.disabled = true;
                    zoomOutButton.disabled = true;
                    fitButton.disabled = true;
                    status.classList.add("is-visible");
                    status.replaceChildren();
                    var card = document.createElement("div");
                    card.className = "house-spy-status-card";
                    var paragraph = document.createElement("p");
                    paragraph.textContent = message;
                    card.append(paragraph);
                    var retry = document.createElement("button");
                    retry.type = "button";
                    retry.textContent = actionLabel || "Tentar de novo";
                    retry.addEventListener("click", action || loadHouse);
                    card.append(retry);
                    status.append(card);
                    floorNode.textContent = message;
                }

                function showLoadError(error) {
                    if (error instanceof Umanthir.GoneError && error.replacedBy) {
                        var renamed = error.replacedBy;
                        showError("Esta casa foi renomeada no cliente.", function () {
                            root.setAttribute("data-house", renamed);
                            loadHouse();
                        }, "Abrir nome atual");
                        return;
                    }
                    showError(describeError(error));
                }
            }

            function applySize(root) {
                root.style.width = cssSize(root.getAttribute("data-width"), "720");
                root.style.height = cssSize(root.getAttribute("data-height"), "480");
            }

            function cssSize(value, fallback) {
                var raw = String(value || "").trim() || fallback;
                if (/^-?\d+(\.\d+)?$/.test(raw)) {
                    return raw + "px";
                }
                return raw;
            }

            function resolveSlug(root) {
                var explicit = String(root.getAttribute("data-house") || "").trim().toLowerCase();
                if (explicit) {
                    return slugify(explicit);
                }
                var pageName = "";
                if (window.mw && window.mw.config && typeof window.mw.config.get === "function") {
                    var configured = window.mw.config.get("wgPageName");
                    if (typeof configured === "string" && configured.indexOf(":") === -1) {
                        pageName = configured.replace(/_/g, " ");
                    }
                }
                if (!pageName) {
                    pageName = document.title.split(" - ")[0].trim();
                }
                if (!pageName || pageName.toLowerCase() === "housespy") {
                    return "";
                }
                return slugify(pageName);
            }

            function decodeEntities(value) {
                var named = { amp: "&", apos: "'", quot: "\"", lt: "<", gt: ">" };
                var current = String(value);
                var guard = 0;
                while (guard < 3) {
                    var next = current
                        .replace(/&#(\d+);/g, function (match, code) {
                            var point = Number(code);
                            return point > 0 && point <= 65535 ? String.fromCharCode(point) : match;
                        })
                        .replace(/&#x([\da-f]+);/gi, function (match, hex) {
                            var point = parseInt(hex, 16);
                            return point > 0 && point <= 65535 ? String.fromCharCode(point) : match;
                        })
                        .replace(/&([a-z]+);/gi, function (match, name) {
                            var key = name.toLowerCase();
                            return Object.prototype.hasOwnProperty.call(named, key) ? named[key] : match;
                        });
                    if (next === current) {
                        break;
                    }
                    current = next;
                    guard += 1;
                }
                return current;
            }

            function slugify(name) {
                var value = decodeEntities(name).normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
                value = value.toLowerCase().replace(/['’]/g, "-");
                value = value.replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
                return value;
            }

            function readFloors(assembly) {
                var list = assembly && Array.isArray(assembly.floors) ? assembly.floors : [];
                var seen = {};
                var floors = [];
                list.forEach(function (floor) {
                    var z = Number(floor && floor.z);
                    if (!Number.isInteger(z) || z < 0 || z > 15 || seen[z]) {
                        return;
                    }
                    seen[z] = true;
                    floors.push({
                        z: z,
                        place: typeof floor.place === "string" ? floor.place : ""
                    });
                });
                floors.sort(function (a, b) {
                    return a.z - b.z;
                });
                return floors;
            }

            function readName(assembly, slug) {
                var house = assembly && assembly.house;
                if (house && typeof house.name === "string" && house.name.trim()) {
                    return house.name.trim();
                }
                return slug;
            }

            function readGround(assembly) {
                var house = assembly && assembly.house;
                var entrance = Number(house && house.entrance && house.entrance.z);
                if (Number.isInteger(entrance) && entrance >= 0 && entrance <= 15) {
                    return entrance;
                }
                return 7;
            }

            function readSurface(assembly) {
                var meta = assembly && assembly.assembly;
                var surface = Number(meta && meta.surface_floor);
                return Number.isFinite(surface) ? surface : 7;
            }

            function readStep(assembly) {
                var meta = assembly && assembly.assembly;
                var step = meta && meta.lower_floor_offset;
                var x = Number(step && step.x);
                var y = Number(step && step.y);
                return {
                    x: Number.isFinite(x) ? x : 32,
                    y: Number.isFinite(y) ? y : 32
                };
            }

            function initialFloor(root, floors, assembly) {
                var requested = Number(root.getAttribute("data-floor"));
                if (floors.some(function (floor) { return floor.z === requested; })) {
                    return requested;
                }
                var house = assembly && assembly.house;
                var entrance = Number(house && house.entrance && house.entrance.z);
                if (floors.some(function (floor) { return floor.z === entrance; })) {
                    return entrance;
                }
                var surface = readSurface(assembly);
                if (floors.some(function (floor) { return floor.z === surface; })) {
                    return surface;
                }
                return floors.slice().sort(function (a, b) {
                    return Math.abs(a.z - 7) - Math.abs(b.z - 7);
                })[0].z;
            }

            function indexOfFloor(floors, z) {
                var index = floors.findIndex(function (floor) {
                    return floor.z === z;
                });
                return index >= 0 ? index : 0;
            }

            function describeError(error) {
                if (!client || typeof Umanthir !== "function") {
                    return "Não foi possível carregar o SDK do Umanthir.";
                }
                if (error instanceof Umanthir.NotFoundError) {
                    return "Não há planta publicada para esta casa.";
                }
                if (error instanceof Umanthir.GoneError) {
                    return "Esta casa não está mais no cliente.";
                }
                if (error instanceof Umanthir.BadRequestError) {
                    return "O identificador da casa não é válido.";
                }
                if (error instanceof Umanthir.RateLimitError) {
                    var wait = error.retryAfter ? " Tente novamente em " + error.retryAfter + " s." : "";
                    return "Limite de consultas do Umanthir atingido." + wait;
                }
                if (error instanceof Umanthir.TimeoutError) {
                    return "A consulta ao Umanthir demorou demais. Tente de novo.";
                }
                if (error instanceof Umanthir.ConnectionError) {
                    return "Não foi possível conectar à API do Umanthir.";
                }
                if (error instanceof Umanthir.ServiceUnavailableError) {
                    return "As plantas das casas estão indisponíveis no momento.";
                }
                if (error instanceof Umanthir.APIError && error.apiMessage) {
                    return error.apiMessage;
                }
                return "Erro ao consultar o Umanthir.";
            }

            function clamp(value, min, max) {
                return Math.min(max, Math.max(min, value));
            }
        }());
        });
    });
}());
