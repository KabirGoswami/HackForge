import React, { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  Activity,
  Filter
} from "lucide-react";
import type { WalletNode, LedgerEdge } from "../engine/forensicEngine";

interface SplitTransactionVisualizer3DProps {
  nodes: WalletNode[];
  edges: LedgerEdge[];
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
  frozenWalletIds: string[];
  onIssueFreeze: (walletId: string) => void;
  height?: number | string;
}

interface SplitStage {
  step: number;
  timeLabel: string;
  title: string;
  description: string;
  activeRole: string;
}

const SPLIT_STAGES: SplitStage[] = [
  {
    step: 0,
    timeLabel: "02:14:00 UTC",
    title: "Stage 0: Exploit Drain",
    description: "Attacker wallet drains $42.00M in a single high-velocity transaction from the protocol vault.",
    activeRole: "exploit_origin"
  },
  {
    step: 1,
    timeLabel: "02:17:30 UTC",
    title: "Stage 1: Peel-Chain Activation",
    description: "Automated peel-chain bot script fractures capital into 8 unequal primary hub distributions.",
    activeRole: "splitter_bot"
  },
  {
    step: 2,
    timeLabel: "02:24:15 UTC",
    title: "Stage 2: Micro-Transaction Fan-Out",
    description: "Funds fracture into 130+ randomized leaf wallets with log-normal timing jitter to mimic noise.",
    activeRole: "privacy_mixer"
  },
  {
    step: 3,
    timeLabel: "02:41:00 UTC",
    title: "Stage 3: Cross-Chain Bridge & ZK Pools",
    description: "Sub-streams route through privacy mixers and Wormhole/Hop bridges with synthetic chain shifts.",
    activeRole: "cross_chain_bridge"
  },
  {
    step: 4,
    timeLabel: "03:15:20 UTC",
    title: "Stage 4: Re-Aggregation Vaults",
    description: "Laundered micro-batches converge at secondary consolidation staging vaults.",
    activeRole: "staging_wallet"
  },
  {
    step: 5,
    timeLabel: "03:48:00 UTC",
    title: "Stage 5: Offshore Cash-Out Interception",
    description: "Final consolidation at offshore OTC deposit endpoint. Targeted by Emergency Freeze Warrant.",
    activeRole: "offshore_exchange"
  }
];

export const SplitTransactionVisualizer3D: React.FC<SplitTransactionVisualizer3DProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  frozenWalletIds,
  onIssueFreeze,
  height = 560
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentStage, setCurrentStage] = useState(2);
  const [isPlaying, setIsPlaying] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [selectedChainFilter, setSelectedChainFilter] = useState<string>("ALL");
  const [hoveredNodeInfo, setHoveredNodeInfo] = useState<WalletNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // References for animation loop
  const animFrameIdRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nodeMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const particleSystemsRef = useRef<{ points: THREE.Points; progress: Float32Array; speeds: Float32Array; curves: THREE.CatmullRomCurve3[] }[]>([]);

  // Filtered nodes based on chain
  const visibleNodes = useMemo(() => {
    if (selectedChainFilter === "ALL") return nodes;
    return nodes.filter(n => n.chain.toLowerCase().includes(selectedChainFilter.toLowerCase()));
  }, [nodes, selectedChainFilter]);

  const activeStageInfo = SPLIT_STAGES[currentStage];

  // Stage timeline auto-stepper
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentStage((prev) => (prev + 1) % SPLIT_STAGES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Three.js 3D Scene Initialization
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const heightPx = typeof height === "number" ? height : container.clientHeight || 560;

    // 1. Scene & Background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x130e1a);
    scene.fog = new THREE.FogExp2(0x130e1a, 0.0016);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(48, width / heightPx, 1, 3000);
    camera.position.set(0, 160, 480);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const pointLightOrigin = new THREE.PointLight(0xff4d6d, 3, 700);
    pointLightOrigin.position.set(-250, 40, -150);
    scene.add(pointLightOrigin);

    const pointLightMixer = new THREE.PointLight(0x9d4edd, 2.5, 600);
    pointLightMixer.position.set(0, 80, 0);
    scene.add(pointLightMixer);

    const pointLightExit = new THREE.PointLight(0x06d6a0, 2.5, 700);
    pointLightExit.position.set(250, -40, 150);
    scene.add(pointLightExit);

    // 5. 3D Grid Plane for spatial depth
    const gridHelper = new THREE.GridHelper(1000, 40, 0x584664, 0x241a2e);
    gridHelper.position.y = -120;
    scene.add(gridHelper);

    // 6. 3D Coordinate Mapping for Nodes
    // Role depth stratification: Exploit (Z: -240) -> Splitters (Z: -120) -> Mixers (Z: 0) -> Bridges (Z: 80) -> Staging (Z: 180) -> CEX (Z: 260)
    const roleZMap: Record<WalletNode["role"], number> = {
      exploit_origin: -240,
      splitter_bot: -120,
      privacy_mixer: 0,
      cross_chain_bridge: 90,
      staging_wallet: 180,
      offshore_exchange: 260,
    };

    const roleColorMap: Record<WalletNode["role"], number> = {
      exploit_origin: 0xff3366,
      splitter_bot: 0xfbbf24,
      privacy_mixer: 0xa855f7,
      cross_chain_bridge: 0x38bdf8,
      staging_wallet: 0xf97316,
      offshore_exchange: 0x10b981,
    };

    const nodePositions = new Map<string, THREE.Vector3>();
    const nodeMeshes = new Map<string, THREE.Mesh>();
    nodeMeshesRef.current = nodeMeshes;

    // Node geometries
    const baseSphereGeo = new THREE.SphereGeometry(1, 24, 24);
    const ringGeo = new THREE.RingGeometry(1.4, 1.8, 32);

    nodes.forEach((node, idx) => {
      // Calculate normalized X & Y from the 2D layout (0..1000, 0..560) centered at 0
      const posX = (node.x - 500) * 0.9;
      const posY = (280 - node.y) * 0.75;
      const baseZ = roleZMap[node.role] || 0;
      // Add slight layered 3D curvature jitter
      const posZ = baseZ + Math.sin(idx * 1.3) * 35;

      const pos = new THREE.Vector3(posX, posY, posZ);
      nodePositions.set(node.id, pos);

      const colorHex = roleColorMap[node.role] || 0xc7a4ff;
      const radius = node.role === "exploit_origin" ? 18 : node.role === "offshore_exchange" ? 16 : 10 + Math.min(8, (node.inflowUsd / 10_000_000) * 4);

      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.35,
        roughness: 0.2,
        metalness: 0.8
      });

      const mesh = new THREE.Mesh(baseSphereGeo, mat);
      mesh.scale.set(radius, radius, radius);
      mesh.position.copy(pos);
      mesh.userData = { nodeId: node.id, nodeData: node };

      scene.add(mesh);
      nodeMeshes.set(node.id, mesh);

      // Add Glowing Halo Ring
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.scale.set(radius * 1.25, radius * 1.25, 1);
      ringMesh.position.copy(pos);
      ringMesh.lookAt(camera.position);
      scene.add(ringMesh);

      // Add vertical energy pillar to floor
      const lineMat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.22 });
      const lineGeo = new THREE.BufferGeometry().setFromPoints([pos, new THREE.Vector3(posX, -120, posZ)]);
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);
    });

    // 7. 3D Curved Splines & Particle Flows
    const particleSystems: { points: THREE.Points; progress: Float32Array; speeds: Float32Array; curves: THREE.CatmullRomCurve3[] }[] = [];
    const splineCurves: THREE.CatmullRomCurve3[] = [];

    edges.forEach((edge) => {
      const srcPos = nodePositions.get(edge.sourceId);
      const tgtPos = nodePositions.get(edge.targetId);
      if (!srcPos || !tgtPos) return;

      // Create an arced 3D midpoint
      const midPos = new THREE.Vector3()
        .addVectors(srcPos, tgtPos)
        .multiplyScalar(0.5);
      // Arc upwards in Y
      const dist = srcPos.distanceTo(tgtPos);
      midPos.y += Math.min(80, dist * 0.25);

      const curve = new THREE.CatmullRomCurve3([srcPos, midPos, tgtPos]);
      splineCurves.push(curve);

      // Render static translucent trajectory arc
      const points = curve.getPoints(36);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
      const arcMat = new THREE.LineBasicMaterial({
        color: 0x9370db,
        transparent: true,
        opacity: 0.28
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      scene.add(arcLine);
    });

    // 8. 3D Flowing Micro-Transaction Particle Clouds
    // Each particle represents a fraction of the micro-transactions
    const particleCountPerStream = 18;
    const totalParticles = splineCurves.length * particleCountPerStream;

    const particlePositions = new Float32Array(totalParticles * 3);
    const particleColors = new Float32Array(totalParticles * 3);
    const particleProgress = new Float32Array(totalParticles);
    const particleSpeeds = new Float32Array(totalParticles);

    let pIdx = 0;
    splineCurves.forEach((curve, cIdx) => {
      for (let i = 0; i < particleCountPerStream; i++) {
        const t = Math.random();
        const pt = curve.getPoint(t);
        particlePositions[pIdx * 3] = pt.x;
        particlePositions[pIdx * 3 + 1] = pt.y;
        particlePositions[pIdx * 3 + 2] = pt.z;

        // Color based on stream progression
        const col = new THREE.Color().setHSL(0.75 - t * 0.45, 0.9, 0.65);
        particleColors[pIdx * 3] = col.r;
        particleColors[pIdx * 3 + 1] = col.g;
        particleColors[pIdx * 3 + 2] = col.b;

        particleProgress[pIdx] = t;
        particleSpeeds[pIdx] = 0.003 + Math.random() * 0.005;
        pIdx++;
      }
    });

    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    particlesGeo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

    // Particle texture generator (radial soft glow)
    const particleCanvas = document.createElement("canvas");
    particleCanvas.width = 32;
    particleCanvas.height = 32;
    const pCtx = particleCanvas.getContext("2d");
    if (pCtx) {
      const grad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.3, "rgba(199,164,255,0.8)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, 32, 32);
    }
    const particleTex = new THREE.CanvasTexture(particleCanvas);

    const particlesMat = new THREE.PointsMaterial({
      size: 7,
      vertexColors: true,
      map: particleTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particleSystem = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particleSystem);

    particleSystems.push({
      points: particleSystem,
      progress: particleProgress,
      speeds: particleSpeeds,
      curves: splineCurves
    });
    particleSystemsRef.current = particleSystems;

    // 9. Interactive Drag Orbit & Mouse Pan Controls
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let spherical = { radius: 520, theta: 0.15, phi: 1.25 };

    const updateCameraFromSpherical = () => {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 20, 0);
    };
    updateCameraFromSpherical();

    const onMouseDown = (e: MouseEvent) => {
      if (e.target !== renderer.domElement) return;
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycasting for node hover
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

      const intersects = raycaster.intersectObjects(Array.from(nodeMeshes.values()));
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const data = hit.userData.nodeData as WalletNode;
        setHoveredNodeInfo(data);
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        setHoveredNodeInfo(null);
        setTooltipPos(null);
      }

      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      spherical.theta -= deltaX * 0.006;
      spherical.phi = Math.max(0.2, Math.min(Math.PI - 0.2, spherical.phi - deltaY * 0.006));
      updateCameraFromSpherical();
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius = Math.max(220, Math.min(950, spherical.radius + e.deltaY * 0.5));
      updateCameraFromSpherical();
    };

    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
      const intersects = raycaster.intersectObjects(Array.from(nodeMeshes.values()));
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const id = hit.userData.nodeId as string;
        onSelectNode(id);
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    domElement.addEventListener("wheel", onWheel, { passive: false });
    domElement.addEventListener("click", onClick);

    // 10. Animation Loop with Micro-Transaction Particle Stream Propagation
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const dt = clock.getDelta();

      // Auto rotation when idle
      if (autoRotate && !isDragging) {
        spherical.theta += dt * 0.12;
        updateCameraFromSpherical();
      }

      // Update particle stream positions along curves
      particleSystems.forEach((ps) => {
        const posAttr = ps.points.geometry.getAttribute("position") as THREE.BufferAttribute;
        const posArr = posAttr.array as Float32Array;
        const curves = ps.curves;
        const pCountPerCurve = particleCountPerStream;

        let ptr = 0;
        curves.forEach((curve) => {
          for (let i = 0; i < pCountPerCurve; i++) {
            ps.progress[ptr] += ps.speeds[ptr];
            if (ps.progress[ptr] > 1.0) ps.progress[ptr] = 0;

            const t = ps.progress[ptr];
            const pt = curve.getPoint(t);
            posArr[ptr * 3] = pt.x;
            posArr[ptr * 3 + 1] = pt.y;
            posArr[ptr * 3 + 2] = pt.z;
            ptr++;
          }
        });
        posAttr.needsUpdate = true;
      });

      // Pulse selected node
      const selMesh = nodeMeshes.get(selectedNodeId);
      if (selMesh) {
        const pulse = 1.0 + Math.sin(clock.getElapsedTime() * 4) * 0.18;
        selMesh.scale.setScalar(18 * pulse);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth || 800;
      const newH = typeof height === "number" ? height : container.clientHeight || 560;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      domElement.removeEventListener("wheel", onWheel);
      domElement.removeEventListener("click", onClick);

      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, [nodes, edges, selectedNodeId, height, autoRotate]);

  return (
    <div
      className={`split-3d-visualizer relative overflow-hidden rounded-xl border border-border bg-[#130e1a] select-none ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none h-screen" : ""
      }`}
      style={{ height: isFullscreen ? "100vh" : height }}
    >
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Overlay: 3D Engine Header & Micro-Transaction Telemetry */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none gap-3">
        <div className="flex items-center gap-2.5 bg-surface/90 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-border shadow-lg pointer-events-auto">
          <Layers size={15} className="text-iris" />
          <span className="text-xs font-semibold text-slate-100">
            3D Peel-Chain Split Engine
          </span>
          <span className="text-[10px] font-mono text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded">
            Fracture Cloud
          </span>
          <span className="text-xs text-muted font-mono hidden sm:inline">
            1,597 micro-txs · 8 hubs
          </span>
        </div>

        {/* Chain Filter & Fullscreen Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1 bg-surface/90 backdrop-blur-md px-2 py-1 rounded-lg border border-border text-xs">
            <Filter size={12} className="text-muted" />
            <select
              value={selectedChainFilter}
              onChange={(e) => setSelectedChainFilter(e.target.value)}
              className="bg-transparent text-[11px] font-mono text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL">All Chains</option>
              <option value="Ethereum">Ethereum (L1)</option>
              <option value="Arbitrum">Arbitrum (L2)</option>
              <option value="Optimism">Optimism (L2)</option>
              <option value="Solana">Solana (Bridge)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              autoRotate ? "bg-iris/20 text-iris border-iris/40" : "bg-surface text-muted border-border hover:text-slate-100"
            }`}
            title={autoRotate ? "Pause 3D orbit rotation" : "Enable 3D orbit rotation"}
          >
            <Activity size={14} />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-surface hover:bg-surface-raised border border-border text-muted hover:text-slate-100 text-xs transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen 3D Matrix"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Floating 3D Node Hover Tooltip */}
      {hoveredNodeInfo && tooltipPos && (
        <div
          className="absolute z-20 pointer-events-none bg-surface-raised/95 backdrop-blur-md border border-iris/40 shadow-2xl rounded-lg p-3 text-xs w-64 -translate-x-1/2 -translate-y-full mb-3"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-border/80 mb-2">
            <span className="font-semibold text-slate-100">{hoveredNodeInfo.label}</span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-iris/15 text-iris border border-iris/30">
              {hoveredNodeInfo.chain}
            </span>
          </div>
          <code className="block text-[10px] font-mono text-muted mb-2 break-all">
            {hoveredNodeInfo.address}
          </code>
          <div className="grid grid-cols-2 gap-1.5 text-[11px] mb-2.5">
            <div>
              <span className="text-muted block text-[10px]">Inflow Flow:</span>
              <strong className="font-mono text-emerald-400">
                ${(hoveredNodeInfo.inflowUsd / 1_000_000).toFixed(2)}M
              </strong>
            </div>
            <div>
              <span className="text-muted block text-[10px]">Bot Jitter:</span>
              <strong className="font-mono text-amber-300">
                ±{hoveredNodeInfo.botJitterMs}ms
              </strong>
            </div>
          </div>
          {frozenWalletIds.includes(hoveredNodeInfo.id) ? (
            <div className="flex items-center gap-1.5 text-[10px] text-danger font-mono font-medium">
              <CheckCircle2 size={12} />
              <span>[ENFORCED FREEZE WARRANT]</span>
            </div>
          ) : (
            <div className="text-[10px] text-muted">Click node in 3D to inspect</div>
          )}
        </div>
      )}

      {/* Bottom Timeline Controls: The 6 Fracture Stages */}
      <div className="absolute bottom-3 left-3 right-3 bg-surface/90 backdrop-blur-md border border-border p-3 rounded-xl shadow-2xl flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 bg-iris/20 hover:bg-iris/30 text-iris rounded-lg border border-iris/40 transition-colors"
            title={isPlaying ? "Pause timeline scrub" : "Play fracture timeline"}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setCurrentStage(0)}
            className="p-2 bg-surface hover:bg-surface-raised text-muted hover:text-slate-200 rounded-lg border border-border transition-colors"
            title="Restart timeline from Exploit Origin"
          >
            <RotateCcw size={14} />
          </button>
          <div className="pr-2 border-r border-border">
            <span className="text-[10px] font-mono text-amber-300 block">
              {activeStageInfo.timeLabel}
            </span>
            <strong className="text-xs text-slate-100 font-semibold block leading-tight">
              {activeStageInfo.title}
            </strong>
          </div>
        </div>

        {/* Timeline Stage Indicators */}
        <div className="flex-1 flex items-center gap-1.5 w-full overflow-x-auto pb-1 sm:pb-0">
          {SPLIT_STAGES.map((stg) => (
            <button
              key={stg.step}
              type="button"
              onClick={() => {
                setCurrentStage(stg.step);
                setIsPlaying(false);
              }}
              className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-md text-left transition-all border ${
                currentStage === stg.step
                  ? "bg-iris/20 border-iris/60 text-slate-100 shadow-sm"
                  : currentStage > stg.step
                    ? "bg-surface-raised border-border/80 text-muted hover:text-slate-200"
                    : "bg-canvas/50 border-border/40 text-muted/60"
              }`}
            >
              <span className="text-[9px] font-mono block text-iris uppercase">Step {stg.step}</span>
              <span className="text-[10px] font-medium block truncate">{stg.title.split(": ")[1]}</span>
            </button>
          ))}
        </div>

        {/* Selected Node Action Button */}
        {selectedNodeId && (
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onIssueFreeze(selectedNodeId)}
              className="button button-sm button-danger flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <ShieldAlert size={13} />
              <span>Freeze Cluster</span>
            </button>
          </div>
        )}
      </div>

      {/* Stage Explainer Banner */}
      <div className="absolute top-14 left-3 max-w-sm pointer-events-none hidden md:block">
        <div className="bg-canvas/80 backdrop-blur-md p-2.5 rounded-lg border border-border text-xs text-slate-300 leading-relaxed">
          <p>{activeStageInfo.description}</p>
        </div>
      </div>
    </div>
  );
};
