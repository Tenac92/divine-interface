(function () {
  const AppNS = (window.App = window.App || {});
  const { useEffect, useMemo, useRef, useState } = React;
  const MapStore = AppNS.MapStore || null;

  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 6;
  const DEFAULT_ZOOM = 1.15;
  const LABEL_MIN_ZOOM = 0.75;
  const VIEW_PADDING = 48;
  const EXPORT_WIDTH = 2200;
  const EXPORT_HEIGHT = 2200;
  const EXPORT_PADDING = 60;
  const FOCUS_LAYERS = ["earth", "districts", "greens", "fields", "buildings"];
  const LAYER_ORDER = [
    "earth",
    "fields",
    "greens",
    "districts",
    "buildings",
    "prisms",
    "squares",
    "roads",
    "walls",
    "gates",
    "rivers",
    "planks",
    "trees",
  ];
  const LAYER_LABELS = {
    earth: "Terrain",
    fields: "Fields",
    greens: "Greens",
    districts: "Districts",
    buildings: "Buildings",
    prisms: "Prisms",
    squares: "Squares",
    roads: "Roads",
    walls: "Walls",
    gates: "Gates",
    rivers: "Rivers",
    planks: "Planks",
    trees: "Trees",
  };
  const DEFAULT_LAYERS = {
    earth: true,
    fields: true,
    greens: true,
    districts: true,
    buildings: true,
    prisms: false,
    squares: false,
    roads: true,
    walls: true,
    gates: true,
    rivers: true,
    planks: false,
    trees: true,
  };
  const LAYER_STYLES = {
    earth: {
      fill: "rgba(12, 22, 32, 0.9)",
      stroke: "rgba(125, 211, 252, 0.15)",
      lineWidth: 1.2,
    },
    fields: {
      fill: "rgba(234, 179, 8, 0.14)",
      stroke: "rgba(234, 179, 8, 0.35)",
      lineWidth: 0.8,
    },
    greens: {
      fill: "rgba(34, 197, 94, 0.2)",
      stroke: "rgba(34, 197, 94, 0.35)",
      lineWidth: 0.8,
    },
    districts: {
      fill: "rgba(125, 211, 252, 0.08)",
      stroke: "rgba(125, 211, 252, 0.35)",
      lineWidth: 0.7,
    },
    buildings: {
      fill: "rgba(100, 116, 139, 0.7)",
      stroke: "rgba(203, 213, 225, 0.35)",
      lineWidth: 0.6,
    },
    prisms: {
      fill: "rgba(14, 116, 144, 0.35)",
      stroke: "rgba(14, 116, 144, 0.7)",
      lineWidth: 0.7,
    },
    squares: {
      fill: "rgba(226, 232, 240, 0.16)",
      stroke: "rgba(226, 232, 240, 0.3)",
      lineWidth: 0.6,
    },
    roads: {
      stroke: "rgba(148, 163, 184, 0.7)",
      lineWidth: 2.2,
    },
    walls: {
      stroke: "rgba(226, 232, 240, 0.65)",
      lineWidth: 1.8,
    },
    gates: {
      fill: "rgba(251, 191, 36, 0.9)",
      stroke: "rgba(251, 191, 36, 0.6)",
      pointRadius: 3.2,
    },
    rivers: {
      stroke: "rgba(56, 189, 248, 0.85)",
      lineWidth: 1.6,
    },
    planks: {
      stroke: "rgba(148, 163, 184, 0.35)",
      lineWidth: 1.2,
    },
    trees: {
      fill: "rgba(34, 197, 94, 0.7)",
      pointRadius: 2.3,
    },
  };

  function normalizeMap(raw) {
    if (!raw || !Array.isArray(raw.features)) return null;
    const layers = {};
    let meta = null;
    const labels = [];
    let districtLabels = [];

    const pushLabel = (entry) => {
      if (!entry) return;
      const text = String(entry.text || entry.label || "").trim();
      if (!text) return;
      let coords = null;
      if (Array.isArray(entry.coordinates)) coords = entry.coordinates;
      if (Array.isArray(entry.coord)) coords = entry.coord;
      if (typeof entry.x === "number" && typeof entry.y === "number") {
        coords = [entry.x, entry.y];
      }
      if (!coords || coords.length < 2) return;
      labels.push({
        text,
        coordinates: [coords[0], coords[1]],
        kind: entry.kind || entry.type || "label",
      });
    };

    if (Array.isArray(raw.labels)) {
      raw.labels.forEach(pushLabel);
    }
    raw.features.forEach((feature) => {
      if (!feature || typeof feature !== "object") return;
      if (feature.id === "values") {
        meta = feature;
        return;
      }
      if (
        feature.id === "labels" &&
        feature.type === "MultiPoint" &&
        Array.isArray(feature.coordinates) &&
        Array.isArray(feature.labels)
      ) {
        feature.coordinates.forEach((coord, index) => {
          pushLabel({
            coordinates: coord,
            text: feature.labels[index],
            kind: "label",
          });
        });
      }
      if (Array.isArray(feature.labels)) {
        feature.labels.forEach(pushLabel);
      }
      if (feature.id === "districts" && Array.isArray(feature.geometries)) {
        districtLabels = createDistrictLabels(feature);
      }
      if (feature.id) {
        layers[feature.id] = feature;
      }
    });
    if (!labels.length && districtLabels.length) {
      labels.push(...districtLabels);
    } else if (!labels.length && layers.districts) {
      labels.push(...createAutoLabels(layers.districts, "District"));
    }
    return { meta, layers, labels };
  }

  function visitCoords(coords, cb) {
    if (!Array.isArray(coords)) return;
    if (coords.length === 0) return;
    if (typeof coords[0] === "number") {
      cb(coords[0], coords[1]);
      return;
    }
    coords.forEach((entry) => visitCoords(entry, cb));
  }

  function walkGeometry(geometry, cb) {
    if (!geometry) return;
    if (geometry.type === "GeometryCollection") {
      (geometry.geometries || []).forEach((entry) => walkGeometry(entry, cb));
      return;
    }
    if (Array.isArray(geometry.coordinates)) {
      visitCoords(geometry.coordinates, cb);
    }
  }

  function collectPolygons(geometry, output) {
    if (!geometry) return;
    if (geometry.type === "Polygon") {
      output.push(geometry.coordinates);
      return;
    }
    if (geometry.type === "MultiPolygon") {
      (geometry.coordinates || []).forEach((rings) => output.push(rings));
      return;
    }
    if (geometry.type === "GeometryCollection") {
      (geometry.geometries || []).forEach((entry) =>
        collectPolygons(entry, output)
      );
    }
  }

  function ringArea(ring) {
    if (!Array.isArray(ring) || ring.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < ring.length; i += 1) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      sum += x1 * y2 - x2 * y1;
    }
    return sum / 2;
  }

  function centroidOfRing(ring) {
    if (!Array.isArray(ring) || ring.length < 3) return null;
    let areaSum = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length; i += 1) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      const f = x1 * y2 - x2 * y1;
      areaSum += f;
      cx += (x1 + x2) * f;
      cy += (y1 + y2) * f;
    }
    if (Math.abs(areaSum) < 1e-6) {
      let sx = 0;
      let sy = 0;
      ring.forEach(([x, y]) => {
        sx += x;
        sy += y;
      });
      return [sx / ring.length, sy / ring.length];
    }
    const area = areaSum / 2;
    return [cx / (6 * area), cy / (6 * area)];
  }

  function nudgeToBBoxCenter(candidate, ring) {
    if (!candidate || !Array.isArray(ring) || !ring.length) return candidate;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    ring.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });
    const [x, y] = candidate;
    if (x < minX || x > maxX || y < minY || y > maxY) {
      return [(minX + maxX) / 2, (minY + maxY) / 2];
    }
    return candidate;
  }

  function labelPointFromGeometry(geometry) {
    if (!geometry) return null;
    if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
      const ring = geometry.coordinates[0];
      const centroid = centroidOfRing(ring);
      return nudgeToBBoxCenter(centroid, ring);
    }
    if (geometry.type === "MultiPolygon") {
      let bestRing = null;
      let bestArea = 0;
      (geometry.coordinates || []).forEach((poly) => {
        const ring = Array.isArray(poly) ? poly[0] : null;
        const area = Math.abs(ringArea(ring));
        if (area > bestArea) {
          bestArea = area;
          bestRing = ring;
        }
      });
      const centroid = centroidOfRing(bestRing);
      return nudgeToBBoxCenter(centroid, bestRing);
    }
    return null;
  }

  function createDistrictLabels(feature) {
    if (!feature || !Array.isArray(feature.geometries)) return [];
    const labels = [];
    feature.geometries.forEach((geom, index) => {
      if (!geom) return;
      const name = String(geom.name || "").trim() || `District ${index + 1}`;
      const point = labelPointFromGeometry(geom);
      if (!point) return;
      labels.push({ text: name, coordinates: point, kind: "district" });
    });
    return labels;
  }

  function collectPolygonBounds(rings) {
    const bounds = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    };
    visitCoords(rings, (x, y) => {
      if (x < bounds.minX) bounds.minX = x;
      if (y < bounds.minY) bounds.minY = y;
      if (x > bounds.maxX) bounds.maxX = x;
      if (y > bounds.maxY) bounds.maxY = y;
    });
    if (!Number.isFinite(bounds.minX)) return null;
    return bounds;
  }

  function createAutoLabels(geometry, prefix) {
    const polygons = [];
    collectPolygons(geometry, polygons);
    const labels = [];
    polygons.forEach((rings, index) => {
      const bounds = collectPolygonBounds(rings);
      if (!bounds) return;
      labels.push({
        text: `${prefix} ${index + 1}`,
        coordinates: [
          (bounds.minX + bounds.maxX) / 2,
          (bounds.minY + bounds.maxY) / 2,
        ],
        kind: "auto",
      });
    });
    return labels;
  }

  function collectBounds(layers) {
    const bounds = {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    };
    Object.values(layers || {}).forEach((feature) => {
      walkGeometry(feature, (x, y) => {
        if (x < bounds.minX) bounds.minX = x;
        if (y < bounds.minY) bounds.minY = y;
        if (x > bounds.maxX) bounds.maxX = x;
        if (y > bounds.maxY) bounds.maxY = y;
      });
    });
    if (!Number.isFinite(bounds.minX)) return null;
    return bounds;
  }

  function getFocusBounds(mapData) {
    if (!mapData) return null;
    for (let i = 0; i < FOCUS_LAYERS.length; i += 1) {
      const id = FOCUS_LAYERS[i];
      if (mapData.layers[id]) {
        return collectBounds({ [id]: mapData.layers[id] });
      }
    }
    return collectBounds(mapData.layers);
  }

  function computeBaseTransform(bounds, size, paddingOverride) {
    if (!bounds || !size.width || !size.height) return null;
    const padding =
      typeof paddingOverride === "number"
        ? paddingOverride
        : Math.min(size.width, size.height) * 0.06;
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxY - bounds.minY;
    if (!worldWidth || !worldHeight) return null;
    const scaleX = (size.width - padding * 2) / worldWidth;
    const scaleY = (size.height - padding * 2) / worldHeight;
    const scale = Math.min(scaleX, scaleY);
    const offsetX =
      (size.width - worldWidth * scale) / 2 - bounds.minX * scale;
    const offsetY =
      (size.height - worldHeight * scale) / 2 + bounds.maxY * scale;
    return { scale, offsetX, offsetY };
  }

  function projectPoint(coord, transform) {
    return [
      coord[0] * transform.scale + transform.offsetX,
      -coord[1] * transform.scale + transform.offsetY,
    ];
  }

  function drawPolygon(ctx, rings, style, transform) {
    if (!Array.isArray(rings)) return;
    ctx.beginPath();
    rings.forEach((ring) => {
      if (!Array.isArray(ring) || ring.length < 2) return;
      const start = projectPoint(ring[0], transform);
      ctx.moveTo(start[0], start[1]);
      for (let i = 1; i < ring.length; i += 1) {
        const point = projectPoint(ring[i], transform);
        ctx.lineTo(point[0], point[1]);
      }
      ctx.closePath();
    });
    if (style.fill) {
      ctx.fillStyle = style.fill;
      ctx.fill("evenodd");
    }
    if (style.stroke) {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = (style.lineWidth || 1) * (transform.pixelRatio || 1);
      ctx.stroke();
    }
  }

  function drawLine(ctx, coords, style, transform) {
    if (!Array.isArray(coords) || coords.length < 2) return;
    ctx.beginPath();
    const start = projectPoint(coords[0], transform);
    ctx.moveTo(start[0], start[1]);
    for (let i = 1; i < coords.length; i += 1) {
      const point = projectPoint(coords[i], transform);
      ctx.lineTo(point[0], point[1]);
    }
    ctx.strokeStyle = style.stroke || "rgba(148, 163, 184, 0.8)";
    ctx.lineWidth = (style.lineWidth || 1) * (transform.pixelRatio || 1);
    ctx.stroke();
  }

  function drawPoint(ctx, coord, style, transform) {
    if (!coord) return;
    const radius = (style.pointRadius || 2) * (transform.pixelRatio || 1);
    const point = projectPoint(coord, transform);
    ctx.beginPath();
    ctx.arc(point[0], point[1], radius, 0, Math.PI * 2);
    if (style.fill) {
      ctx.fillStyle = style.fill;
      ctx.fill();
    }
    if (style.stroke) {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = (style.lineWidth || 1) * (transform.pixelRatio || 1);
      ctx.stroke();
    }
  }

  function drawPoints(ctx, coords, style, transform) {
    if (!Array.isArray(coords)) return;
    ctx.fillStyle = style.fill || "rgba(34, 197, 94, 0.7)";
    coords.forEach((coord) => drawPoint(ctx, coord, style, transform));
  }

  function drawGeometry(ctx, geometry, style, transform) {
    if (!geometry) return;
    if (geometry.type === "Polygon") {
      drawPolygon(ctx, geometry.coordinates, style, transform);
      return;
    }
    if (geometry.type === "MultiPolygon") {
      (geometry.coordinates || []).forEach((rings) =>
        drawPolygon(ctx, rings, style, transform)
      );
      return;
    }
    if (geometry.type === "LineString") {
      drawLine(ctx, geometry.coordinates, style, transform);
      return;
    }
    if (geometry.type === "MultiLineString") {
      (geometry.coordinates || []).forEach((line) =>
        drawLine(ctx, line, style, transform)
      );
      return;
    }
    if (geometry.type === "MultiPoint") {
      drawPoints(ctx, geometry.coordinates, style, transform);
      return;
    }
    if (geometry.type === "Point") {
      drawPoint(ctx, geometry.coordinates, style, transform);
      return;
    }
    if (geometry.type === "GeometryCollection") {
      (geometry.geometries || []).forEach((entry) =>
        drawGeometry(ctx, entry, style, transform)
      );
    }
  }

  function drawMap(ctx, mapData, layerState, transform) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    LAYER_ORDER.forEach((layerId) => {
      if (!layerState[layerId]) return;
      const layer = mapData.layers[layerId];
      if (!layer) return;
      const style = LAYER_STYLES[layerId] || {};
      drawGeometry(ctx, layer, style, transform);
    });
    if (mapData.labels && mapData.labels.length) {
      drawLabels(ctx, mapData.labels, transform);
    }
    ctx.restore();
  }

  function drawLabels(ctx, labels, transform) {
    if (!Array.isArray(labels) || !labels.length) return;
    if (transform.zoom && transform.zoom < LABEL_MIN_ZOOM) return;
    const pr = transform.pixelRatio || 1;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(12 * pr)}px "Space Grotesk", "Inter", sans-serif`;
    ctx.lineWidth = 3 * pr;
    ctx.strokeStyle = "rgba(2, 6, 23, 0.85)";
    ctx.fillStyle = "rgba(226, 232, 240, 0.95)";
    labels.forEach((label) => {
      if (!label || !label.coordinates) return;
      const point = projectPoint(label.coordinates, transform);
      ctx.strokeText(label.text, point[0], point[1]);
      ctx.fillText(label.text, point[0], point[1]);
    });
    ctx.restore();
  }

  function getLegendSwatchStyle(layerId) {
    const style = LAYER_STYLES[layerId] || {};
    if (style.pointRadius) {
      return {
        width: "10px",
        height: "10px",
        borderRadius: "999px",
        background: style.fill || style.stroke || "#e2e8f0",
        border: style.stroke ? `1px solid ${style.stroke}` : "none",
      };
    }
    if (style.fill) {
      return {
        width: "14px",
        height: "14px",
        borderRadius: "4px",
        background: style.fill,
        border: style.stroke ? `1px solid ${style.stroke}` : "none",
      };
    }
    return {
      width: "18px",
      height: "3px",
      borderRadius: "999px",
      background: style.stroke || "#e2e8f0",
    };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function MapPage() {
    const canvasRef = useRef(null);
    const [mapData, setMapData] = useState(null);
    const [error, setError] = useState(null);
    const [mapList, setMapList] = useState([]);
    const [activeMapId, setActiveMapId] = useState(null);
    const [activeEntry, setActiveEntry] = useState(null);
    const [loadingMap, setLoadingMap] = useState(false);
    const [defaultMapId, setDefaultMapId] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [layers, setLayers] = useState(DEFAULT_LAYERS);
    const [showLabels, setShowLabels] = useState(false);
    const [view, setView] = useState({
      zoom: DEFAULT_ZOOM,
      panX: 0,
      panY: 0,
    });
    const [canvasSize, setCanvasSize] = useState({
      width: 0,
      height: 0,
      dpr: 1,
    });

    const bounds = useMemo(() => getFocusBounds(mapData), [mapData]);
    const viewPadding = useMemo(
      () => VIEW_PADDING * (canvasSize.dpr || 1),
      [canvasSize.dpr]
    );
    const baseTransform = useMemo(
      () => computeBaseTransform(bounds, canvasSize, viewPadding),
      [bounds, canvasSize, viewPadding]
    );
    const availableLayerIds = useMemo(() => {
      if (!mapData) return [];
      return LAYER_ORDER.filter((layerId) => mapData.layers[layerId]);
    }, [mapData]);
    const activeLayerCount = useMemo(
      () => availableLayerIds.filter((layerId) => layers[layerId]).length,
      [availableLayerIds, layers]
    );

    const refreshMapList = async () => {
      if (!MapStore) {
        setError("Map library unavailable.");
        return;
      }
      try {
        if (MapStore.refreshRemoteList) {
          await MapStore.refreshRemoteList();
        }
      } catch (err) {
        setError(err?.message || "Failed to refresh map library.");
      }
      const list = MapStore.listMaps();
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setMapList(list);
      const defaultId = MapStore.getDefaultMapId();
      setDefaultMapId(defaultId);
      setActiveMapId((prev) => {
        if (prev && list.some((m) => m.id === prev)) return prev;
        return MapStore.getActiveMapId();
      });
    };

    useEffect(() => {
      refreshMapList();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (!MapStore || !activeMapId) return;
      let active = true;
      async function loadSelected() {
        try {
          setLoadingMap(true);
          setError(null);
          const { entry, raw } = await MapStore.loadMap(activeMapId);
          const normalized = normalizeMap(raw);
          if (!normalized) throw new Error("Invalid map JSON format.");
          if (!active) return;
          setMapData(normalized);
          setActiveEntry(entry);
          setLayers({ ...DEFAULT_LAYERS });
          setView({ zoom: DEFAULT_ZOOM, panX: 0, panY: 0 });
          setShowLabels(!!(normalized.labels && normalized.labels.length));
        } catch (err) {
          if (active) setError(err?.message || "Failed to load map.");
        } finally {
          if (active) setLoadingMap(false);
        }
      }
      loadSelected();
      return () => {
        active = false;
      };
    }, [activeMapId]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const resize = () => {
        const rect = parent.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.floor(rect.width * dpr));
        const height = Math.max(1, Math.floor(rect.height * dpr));
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        setCanvasSize({ width, height, dpr });
      };
      resize();
      let cleanup = () => {};
      if (window.ResizeObserver) {
        const observer = new ResizeObserver(resize);
        observer.observe(parent);
        cleanup = () => observer.disconnect();
      } else {
        window.addEventListener("resize", resize);
        cleanup = () => window.removeEventListener("resize", resize);
      }
      return cleanup;
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !mapData || !baseTransform) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const transform = {
        scale: baseTransform.scale * view.zoom,
        offsetX: baseTransform.offsetX + view.panX,
        offsetY: baseTransform.offsetY + view.panY,
        pixelRatio: canvasSize.dpr || 1,
        zoom: view.zoom,
      };
      drawMap(
        ctx,
        { ...mapData, labels: showLabels ? mapData.labels : [] },
        layers,
        transform
      );
    }, [mapData, layers, view, baseTransform, showLabels]);

    const resetView = () => {
      setView({ zoom: DEFAULT_ZOOM, panX: 0, panY: 0 });
    };

    const exportMapPng = async () => {
      if (!mapData) return;
      try {
        setExporting(true);
        setError(null);
        const canvas = document.createElement("canvas");
        canvas.width = EXPORT_WIDTH;
        canvas.height = EXPORT_HEIGHT;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Export canvas not available.");
        ctx.fillStyle = "#05080f";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const bounds = getFocusBounds(mapData);
        const base = computeBaseTransform(bounds, canvas, EXPORT_PADDING);
        if (!base) throw new Error("Unable to fit map bounds.");
        const transform = {
          scale: base.scale,
          offsetX: base.offsetX,
          offsetY: base.offsetY,
          pixelRatio: 1,
          zoom: 1,
        };
        drawMap(
          ctx,
          { ...mapData, labels: showLabels ? mapData.labels : [] },
          layers,
          transform
        );
        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error("PNG export failed."));
          }, "image/png");
        });
        const filename = `${(activeEntry?.name || "map")
          .replace(/[^\w\-]+/g, "_")
          .slice(0, 64)}.png`;
        downloadBlob(blob, filename);
      } catch (err) {
        setError(err?.message || "Failed to export PNG.");
      } finally {
        setExporting(false);
      }
    };

    const handleMapSelect = (event) => {
      const nextId = event.target.value;
      setActiveMapId(nextId);
      if (MapStore) {
        MapStore.setActiveMapId(nextId);
      }
    };

    const handleRefreshMaps = async () => {
      await refreshMapList();
    };

    const resetLayers = () => {
      setLayers({ ...DEFAULT_LAYERS });
    };

    const toggleAllLayers = (value) => {
      if (!mapData) return;
      setLayers((prev) => {
        const next = { ...prev };
        LAYER_ORDER.forEach((layerId) => {
          if (mapData.layers[layerId]) {
            next[layerId] = value;
          }
        });
        return next;
      });
    };

    const applyZoom = (zoomUpdate, anchor) => {
      if (!baseTransform) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const px =
        anchor && typeof anchor.x === "number" ? anchor.x : canvas.width / 2;
      const py =
        anchor && typeof anchor.y === "number" ? anchor.y : canvas.height / 2;
      setView((prev) => {
        const nextZoomRaw =
          typeof zoomUpdate === "function" ? zoomUpdate(prev.zoom) : zoomUpdate;
        const nextZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nextZoomRaw));
        const scale = baseTransform.scale * prev.zoom;
        const offsetX = baseTransform.offsetX + prev.panX;
        const offsetY = baseTransform.offsetY + prev.panY;
        const worldX = (px - offsetX) / scale;
        const worldY = -(py - offsetY) / scale;
        const nextScale = baseTransform.scale * nextZoom;
        const nextOffsetX = px - worldX * nextScale;
        const nextOffsetY = py + worldY * nextScale;
        return {
          zoom: nextZoom,
          panX: nextOffsetX - baseTransform.offsetX,
          panY: nextOffsetY - baseTransform.offsetY,
        };
      });
    };

    const handleWheel = (event) => {
      if (!baseTransform) return;
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = canvasSize.dpr || 1;
      const px = (event.clientX - rect.left) * dpr;
      const py = (event.clientY - rect.top) * dpr;
      const zoomFactor = event.deltaY < 0 ? 1.12 : 0.9;
      applyZoom((current) => current * zoomFactor, { x: px, y: py });
    };

    const draggingRef = useRef(null);
    const handlePointerDown = (event) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(event.pointerId);
      draggingRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPanX: view.panX,
        startPanY: view.panY,
      };
    };
    const handlePointerMove = (event) => {
      const drag = draggingRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dpr = canvasSize.dpr || 1;
      const dx = (event.clientX - drag.startX) * dpr;
      const dy = (event.clientY - drag.startY) * dpr;
      setView((prev) => ({
        zoom: prev.zoom,
        panX: drag.startPanX + dx,
        panY: drag.startPanY + dy,
      }));
    };
    const handlePointerUp = (event) => {
      const canvas = canvasRef.current;
      if (canvas && canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      draggingRef.current = null;
    };

    const metaName = mapData?.meta?.name || activeEntry?.name || "Map";
    const metaNotes = mapData?.meta?.notes || "";
    const zoomLabel = `${Math.round(view.zoom * 100)}%`;
    const zoomOutDisabled = view.zoom <= ZOOM_MIN + 0.01;
    const zoomInDisabled = view.zoom >= ZOOM_MAX - 0.01;
    const labelCount = mapData?.labels?.length || 0;
    const labelsDisabled = labelCount === 0;
    const mapBackdropStyle = {
      backgroundImage:
        "radial-gradient(circle at 15% 20%, rgba(125, 211, 252, 0.12), transparent 55%), radial-gradient(circle at 85% 10%, rgba(59, 130, 246, 0.18), transparent 45%), linear-gradient(180deg, rgba(9, 14, 22, 0.9), rgba(2, 6, 23, 0.95))",
    };
    const mapGridStyle = {
      backgroundImage:
        "linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)",
      backgroundSize: "48px 48px",
      opacity: 0.6,
    };

    return React.createElement(
      "div",
      { className: "grid gap-4" },
      React.createElement(
        "div",
        { className: "card grid gap-4" },
        React.createElement(
          "div",
          { className: "flex flex-wrap items-center justify-between gap-3" },
          React.createElement(
            "div",
            { className: "grid gap-1" },
            React.createElement(
              "h2",
              { className: "text-xl font-semibold" },
              metaName
            ),
            React.createElement(
              "p",
              { className: "text-sm opacity-70" },
              metaNotes || "Map preview ready."
            ),
            React.createElement(
              "p",
              { className: "text-xs opacity-50" },
              "Library: ",
              activeEntry ? activeEntry.name : "No map selected"
            ),
            React.createElement(
              "div",
              { className: "flex flex-wrap items-center gap-2 text-xs" },
              activeEntry &&
                React.createElement(
                  "span",
                  { className: "tag" },
                  activeEntry.source === "builtin" ? "Built-in" : "Local"
                ),
              defaultMapId === activeMapId &&
                React.createElement("span", { className: "tag" }, "Default"),
              loadingMap &&
                React.createElement("span", { className: "tag" }, "Loading...")
            )
          ),
          React.createElement(
            "div",
            { className: "flex flex-wrap items-center gap-2" },
            React.createElement(
              "label",
              { className: "ui-field min-w-[220px]" },
              React.createElement(
                "span",
                { className: "ui-label" },
                "Map Library"
              ),
              React.createElement(
                "select",
                {
                  className: "ui-select",
                  value: activeMapId || "",
                  onChange: handleMapSelect,
                  disabled: !mapList.length || loadingMap,
                },
                mapList.length
                  ? mapList.map((entry) =>
                      React.createElement(
                        "option",
                        { key: entry.id, value: entry.id },
                        entry.name
                      )
                    )
                  : React.createElement("option", { value: "" }, "No maps")
              )
            ),
            React.createElement(
              "button",
              { className: "btn text-sm", onClick: handleRefreshMaps },
              "Refresh list"
            ),
            React.createElement(
              "button",
              { className: "btn text-sm", onClick: resetView },
              "Reset view"
            ),
            React.createElement(
              "button",
              {
                className: "btn text-sm",
                onClick: exportMapPng,
                disabled: exporting || !mapData,
              },
              exporting ? "Exporting..." : "Export PNG"
            )
          )
        ),
        error &&
          React.createElement(
            "div",
            {
              className:
                "text-sm border border-red-400/40 bg-red-500/10 text-red-100 rounded-lg p-3",
            },
            error
          ),
        React.createElement(
          "div",
          { className: "grid gap-4 lg:grid-cols-[260px_1fr]" },
          React.createElement(
            "div",
            { className: "grid gap-4" },
            React.createElement(
              "div",
              { className: "grid gap-3" },
              React.createElement(
                "h3",
                { className: "text-sm font-semibold uppercase tracking-wide" },
                "Layers"
              ),
              React.createElement(
                "div",
                { className: "flex flex-wrap gap-2" },
                React.createElement(
                  "button",
                  {
                    className: "btn text-xs",
                    onClick: () => toggleAllLayers(true),
                    disabled: !mapData,
                    style: { padding: "4px 10px" },
                  },
                  "All"
                ),
                React.createElement(
                  "button",
                  {
                    className: "btn text-xs",
                    onClick: () => toggleAllLayers(false),
                    disabled: !mapData,
                    style: { padding: "4px 10px" },
                  },
                  "None"
                ),
                React.createElement(
                  "button",
                  {
                    className: "btn text-xs",
                    onClick: resetLayers,
                    disabled: !mapData,
                    style: { padding: "4px 10px" },
                  },
                  "Default"
                )
              ),
              React.createElement(
                "label",
                {
                  className:
                    "flex items-center justify-between gap-3 text-sm border border-slate-500/30 rounded-xl px-3 py-2",
                },
                React.createElement(
                  "span",
                  { className: labelsDisabled ? "opacity-40" : "" },
                  "Labels",
                  labelCount ? ` (${labelCount})` : ""
                ),
                React.createElement("input", {
                  type: "checkbox",
                  className: "accent-sky-300",
                  checked: showLabels && !labelsDisabled,
                  disabled: labelsDisabled,
                  onChange: () => setShowLabels((prev) => !prev),
                })
              ),
              LAYER_ORDER.map((layerId) => {
                const available = !!(mapData && mapData.layers[layerId]);
                return React.createElement(
                  "label",
                  {
                    key: layerId,
                    className:
                      "flex items-center justify-between gap-3 text-sm border border-slate-500/30 rounded-xl px-3 py-2",
                  },
                  React.createElement(
                    "span",
                    { className: available ? "" : "opacity-40" },
                    LAYER_LABELS[layerId] || layerId
                  ),
                  React.createElement("input", {
                    type: "checkbox",
                    className: "accent-sky-300",
                    checked: !!layers[layerId],
                    disabled: !available,
                    onChange: () =>
                      setLayers((prev) => ({
                        ...prev,
                        [layerId]: !prev[layerId],
                      })),
                  })
                );
              })
            ),
            React.createElement(
              "div",
              { className: "grid gap-3" },
              React.createElement(
                "h3",
                { className: "text-sm font-semibold uppercase tracking-wide" },
                "Legend"
              ),
              availableLayerIds.length
                ? availableLayerIds.map((layerId) =>
                    React.createElement(
                      "div",
                      {
                        key: `legend-${layerId}`,
                        className:
                          "flex items-center justify-between gap-3 text-xs border border-slate-500/20 rounded-xl px-3 py-2",
                      },
                      React.createElement(
                        "div",
                        { className: "flex items-center gap-2" },
                        React.createElement("span", {
                          style: getLegendSwatchStyle(layerId),
                        }),
                        React.createElement(
                          "span",
                          null,
                          LAYER_LABELS[layerId] || layerId
                        )
                      ),
                      React.createElement(
                        "span",
                        { className: "opacity-50" },
                        layers[layerId] ? "On" : "Off"
                      )
                    )
                  )
                : React.createElement(
                    "div",
                    {
                      className:
                        "text-xs text-slate-200/60 border border-slate-500/20 rounded-xl px-3 py-2",
                    },
                    "No legend data."
                  )
            )
          ),
          React.createElement(
            "div",
            {
              className:
                "relative w-full min-h-[420px] h-[70vh] border border-slate-500/30 rounded-2xl overflow-hidden bg-slate-950/60",
            },
            React.createElement("div", {
              className: "absolute inset-0 z-0 pointer-events-none",
              style: mapBackdropStyle,
            }),
            React.createElement("div", {
              className: "absolute inset-0 z-0 pointer-events-none",
              style: mapGridStyle,
            }),
            React.createElement("canvas", {
              ref: canvasRef,
              className:
                "relative z-10 w-full h-full touch-none cursor-grab active:cursor-grabbing",
              onWheel: handleWheel,
              onPointerDown: handlePointerDown,
              onPointerMove: handlePointerMove,
              onPointerUp: handlePointerUp,
              onPointerLeave: handlePointerUp,
            }),
            React.createElement(
              "div",
              {
                className:
                  "absolute left-3 top-3 z-20 flex flex-col gap-2 pointer-events-auto",
              },
              React.createElement(
                "div",
                {
                  className:
                    "flex items-center gap-2 rounded-full border border-slate-600/50 bg-slate-950/80 px-3 py-2",
                },
                React.createElement(
                  "button",
                  {
                    className: "btn text-xs",
                    onClick: () => applyZoom((current) => current / 1.2),
                    disabled: zoomOutDisabled,
                    style: { padding: "4px 10px" },
                  },
                  "-"
                ),
                React.createElement("input", {
                  type: "range",
                  min: ZOOM_MIN,
                  max: ZOOM_MAX,
                  step: "0.05",
                  value: view.zoom,
                  onChange: (event) =>
                    applyZoom(parseFloat(event.target.value)),
                  className: "w-28 accent-sky-300",
                }),
                React.createElement(
                  "button",
                  {
                    className: "btn text-xs",
                    onClick: () => applyZoom((current) => current * 1.2),
                    disabled: zoomInDisabled,
                    style: { padding: "4px 10px" },
                  },
                  "+"
                ),
                React.createElement(
                  "span",
                  { className: "text-xs opacity-70 w-12 text-right" },
                  zoomLabel
                )
              ),
              React.createElement(
                "div",
                {
                  className:
                    "text-xs text-slate-200/70 bg-slate-900/80 border border-slate-600/40 rounded-full px-3 py-1",
                },
                "Layers ",
                activeLayerCount,
                "/",
                availableLayerIds.length
              ),
              showLabels &&
                labelCount > 0 &&
                view.zoom < LABEL_MIN_ZOOM &&
                React.createElement(
                  "div",
                  {
                    className:
                      "text-xs text-slate-200/70 bg-slate-900/80 border border-slate-600/40 rounded-full px-3 py-1",
                  },
                  "Zoom in for labels"
                )
            ),
            React.createElement(
              "div",
              {
                className:
                  "absolute bottom-3 right-3 z-20 text-xs text-slate-200/70 bg-slate-900/80 border border-slate-600/40 rounded-full px-3 py-1",
              },
              "Drag to pan, scroll to zoom"
            )
          )
        )
      )
    );
  }

  AppNS.MapPage = MapPage;
})();
