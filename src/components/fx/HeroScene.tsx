"use client";

/**
 * HeroScene — the interactive 3D centrepiece of the landing page.
 *
 * Built with three.js + @react-three/fiber. The scene shows an "AI core":
 *   - a pulsing plasma orb (custom GLSL shader: vertex displacement + fresnel
 *     rim lighting that cycles through the neon palette),
 *   - a counter-rotating wireframe shell,
 *   - three glowing orbit rings,
 *   - holographic cards orbiting the core — one per REAL listing passed in
 *     from the server (title + price + category drawn onto a canvas texture).
 *     Each card is interactive: hovering highlights/scales it and changes the
 *     cursor, and clicking navigates straight to `/listings/[id]`,
 *   - a spiral galaxy of ~2,000 additive particles.
 *
 * Interaction: the whole rig tilts towards the mouse (smoothly lerped) and
 * spins/zooms slightly as the page scrolls. The render loop is paused when
 * the canvas is off-screen to save battery/GPU.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { hueFor } from "@/lib/hue";

/** Data for one orbiting holographic listing card. */
export interface HeroCard {
  id: string;
  title: string;
  priceLabel: string;
  category: string;
  verified: boolean;
}

/* ------------------------------------------------------------------------- */
/* Plasma orb shader                                                          */
/* ------------------------------------------------------------------------- */

const orbVertex = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vDisp;

  void main() {
    vec3 p = position;
    // Layered sine "noise" makes the surface ripple organically.
    float d =
      sin(p.x * 3.1 + uTime * 1.2) * sin(p.y * 2.7 + uTime * 0.9) * sin(p.z * 3.3 + uTime * 1.1) * 0.14 +
      sin(p.x * 7.0 - uTime * 1.7) * sin(p.y * 6.0 + uTime * 1.3) * 0.035;
    p += normal * d;
    vDisp = d;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const orbFragment = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vDisp;

  void main() {
    // Fresnel: edges facing away from the camera glow brightest.
    float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.2);

    // Neon palette — violet, cyan, magenta — blended by normal + time.
    vec3 violet = vec3(0.545, 0.361, 0.965);
    vec3 cyan = vec3(0.133, 0.827, 0.933);
    vec3 magenta = vec3(0.910, 0.475, 0.976);
    float t = 0.5 + 0.5 * sin(uTime * 0.6 + vNormal.y * 3.0 + vNormal.x * 2.0);
    vec3 base = mix(violet, cyan, t);
    base = mix(base, magenta, smoothstep(0.4, 1.0, fres) * 0.6);

    // Dark core, bright rim, plus highlights on the displacement ridges.
    vec3 col = base * (0.18 + fres * 1.6) + vec3(vDisp * 2.5) * cyan;
    float alpha = 0.55 + fres * 0.45;
    gl_FragColor = vec4(col, alpha);
  }
`;

/** The pulsing plasma orb at the centre of the scene. */
function PlasmaOrb() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((_, dt) => {
    if (mat.current) mat.current.uniforms.uTime.value += dt;
  });

  return (
    <mesh raycast={() => null}>
      <icosahedronGeometry args={[1.25, 48]} />
      <shaderMaterial
        ref={mat}
        vertexShader={orbVertex}
        fragmentShader={orbFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------------- */
/* Wireframe shell + rings                                                    */
/* ------------------------------------------------------------------------- */

/** A geodesic wireframe cage that slowly counter-rotates around the orb. */
function WireShell() {
  const ref = useRef<THREE.LineSegments>(null);
  const geo = useMemo(
    () => new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.75, 1)),
    [],
  );
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y -= dt * 0.12;
    ref.current.rotation.x += dt * 0.05;
  });
  return (
    <lineSegments ref={ref} geometry={geo} raycast={() => null}>
      <lineBasicMaterial color="#a78bfa" transparent opacity={0.28} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}

/** One thin glowing torus ring with its own tilt and spin speed. */
function Ring({
  radius,
  color,
  tilt,
  speed,
}: {
  radius: number;
  color: string;
  tilt: [number, number, number];
  speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * speed;
  });
  return (
    <group rotation={tilt}>
      <mesh ref={ref} raycast={() => null}>
        <torusGeometry args={[radius, 0.008, 8, 180]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------------- */
/* Holographic listing cards                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Draw a glassy card (gradient, border, category, title, price) onto a 2D
 * canvas and return it as a three.js texture.
 */
function makeCardTexture(card: HeroCard): THREE.CanvasTexture {
  const w = 512;
  const h = 320;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const hue = hueFor(card.category);

  // Rounded-rect path helper.
  const rr = (x: number, y: number, ww: number, hh: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + ww, y, x + ww, y + hh, r);
    ctx.arcTo(x + ww, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r);
    ctx.arcTo(x, y, x + ww, y, r);
    ctx.closePath();
  };

  // Glass body with a category-tinted gradient.
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsla(${hue}, 85%, 60%, 0.55)`);
  g.addColorStop(1, `hsla(${(hue + 60) % 360}, 85%, 45%, 0.25)`);
  rr(6, 6, w - 12, h - 12, 36);
  ctx.fillStyle = "rgba(10, 12, 30, 0.75)";
  ctx.fill();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = `hsla(${hue}, 100%, 75%, 0.9)`;
  ctx.stroke();

  // Category pill.
  ctx.font = "600 26px system-ui, sans-serif";
  const label = card.category.toUpperCase();
  const lw = ctx.measureText(label).width + 36;
  rr(34, 34, lw, 46, 23);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, 52, 66);

  // Verified badge.
  if (card.verified) {
    ctx.fillStyle = "#a3e635";
    ctx.font = "700 26px system-ui, sans-serif";
    ctx.fillText("✓ AI VERIFIED", w - 230, 66);
  }

  // Title (truncated to fit).
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 46px system-ui, sans-serif";
  let title = card.title;
  while (ctx.measureText(title).width > w - 80 && title.length > 4) {
    title = title.slice(0, -2);
  }
  if (title !== card.title) title = `${title.trimEnd()}…`;
  ctx.fillText(title, 34, 170);

  // Price.
  ctx.font = "700 54px ui-monospace, monospace";
  ctx.fillStyle = "#67e8f9";
  ctx.fillText(card.priceLabel, 34, 262);

  // Subtle interactive CTA cue in the bottom-right corner so users can tell
  // the orbiting hologram can be clicked to open the listing.
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  const ctaText = "OPEN →";
  const ctaWidth = ctx.measureText(ctaText).width;
  ctx.fillText(ctaText, w - ctaWidth - 36, 260);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A single card orbiting on an inclined ellipse, always facing the camera. */
function OrbitCard({
  card,
  index,
  total,
  onSelect,
}: {
  card: HeroCard;
  index: number;
  total: number;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const [hovered, setHovered] = useState(false);
  const texture = useMemo(() => makeCardTexture(card), [card]);
  // Free the GPU texture when the card unmounts.
  useEffect(() => () => texture.dispose(), [texture]);

  // Reset the pointer cursor if the component unmounts while hovered.
  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
    };
  }, []);

  // Each card gets its own orbit radius, inclination, speed and phase.
  // We advance the angle manually so hovering a card can smoothly pause its
  // motion, making it effortless to click.
  const params = useMemo(() => {
    const phase = (index / total) * Math.PI * 2;
    return {
      phase,
      radius: 2.9 + (index % 3) * 0.45,
      incline: ((index % 4) - 1.5) * 0.28,
      speed: 0.16 + (index % 3) * 0.035,
    };
  }, [index, total]);
  const angleRef = useRef(params.phase);

  useFrame(({ clock }, dt) => {
    const m = ref.current;
    if (!m) return;
    // Slow down to a stop while hovered so the card doesn't slip away under the cursor.
    const speedFactor = hovered ? 0.05 : 1;
    angleRef.current += dt * params.speed * speedFactor;
    const a = angleRef.current;
    // Elliptical orbit tilted by `incline`.
    const x = Math.cos(a) * params.radius;
    const z = Math.sin(a) * params.radius * 0.75;
    m.position.set(x, Math.sin(a) * params.incline * 2 + Math.sin(clock.elapsedTime + index) * 0.08, z);
    // Billboard: face the camera.
    m.quaternion.copy(camera.quaternion);
    // Cards behind the orb fade and shrink for depth; hovered card pops forward.
    const depth = (z / (params.radius * 0.75) + 1) / 2; // 0 back → 1 front
    const targetScale = (0.75 + depth * 0.35) * (hovered ? 1.15 : 1);
    m.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.18);
    (m.material as THREE.MeshBasicMaterial).opacity = hovered ? 1 : 0.35 + depth * 0.65;
  });

  return (
    <mesh
      ref={ref}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "";
        onSelect(card.id);
      }}
    >
      <planeGeometry args={[1.28, 0.8]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ------------------------------------------------------------------------- */
/* Particle galaxy                                                            */
/* ------------------------------------------------------------------------- */

/**
 * Small seeded PRNG (mulberry32). Deterministic, so the galaxy layout is
 * identical on every render/mount — keeps the render function pure.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build position + colour buffers for a 3-armed spiral galaxy. */
function buildGalaxy(count: number): { positions: Float32Array; colors: Float32Array } {
  const rand = mulberry32(1337);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const inner = new THREE.Color("#22d3ee");
  const outer = new THREE.Color("#c026d3");
  const tmp = new THREE.Color();
  const arms = 3;
  for (let i = 0; i < count; i++) {
    // Radius biased towards the centre; spin increases with radius.
    const r = Math.pow(rand(), 1.6) * 7 + 1.8;
    const arm = ((i % arms) / arms) * Math.PI * 2;
    const spin = r * 0.55;
    // Random scatter that grows towards the outer edge.
    const scatter = () => (rand() - 0.5) * Math.pow(rand(), 2) * r * 0.5;
    positions[i * 3] = Math.cos(arm + spin) * r + scatter();
    positions[i * 3 + 1] = scatter() * 0.35;
    positions[i * 3 + 2] = Math.sin(arm + spin) * r + scatter();
    // Colour shifts from cyan (core) to magenta (rim).
    tmp.copy(inner).lerp(outer, (r - 1.8) / 7);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  return { positions, colors };
}

/** ~2,000 additive particles arranged as a 3-armed spiral galaxy. */
function Galaxy({ count = 2200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors } = useMemo(() => buildGalaxy(count), [count]);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.04;
  });

  return (
    <points ref={ref} rotation={[0.45, 0, 0.12]} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ------------------------------------------------------------------------- */
/* Rig: mouse parallax + scroll reaction                                      */
/* ------------------------------------------------------------------------- */

function Rig({ cards, onSelect }: { cards: HeroCard[]; onSelect: (id: string) => void }) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Group>(null);
  // Window-wide pointer (-1..1) so the rig reacts even when the cursor is
  // over the headline / search bar layered above the canvas.
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const p = pointer.current;
    // Scroll progress through the first viewport (0..1).
    const scroll = Math.min(window.scrollY / window.innerHeight, 1);
    // Smoothly tilt towards the pointer (frame-rate independent lerp).
    const k = 1 - Math.pow(0.002, dt);
    g.rotation.x += (p.y * -0.25 + scroll * 0.6 - g.rotation.x) * k;
    g.rotation.y += (p.x * 0.45 + scroll * 1.2 - g.rotation.y) * k;
    g.position.y += (scroll * 0.8 - g.position.y) * k;
    // Gentle "breathing" of the core.
    if (core.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 1.4) * 0.03;
      core.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={group}>
      <Galaxy />
      <group ref={core}>
        <PlasmaOrb />
        <WireShell />
      </group>
      <Ring radius={2.1} color="#22d3ee" tilt={[1.2, 0.2, 0]} speed={0.4} />
      <Ring radius={2.35} color="#e879f9" tilt={[1.6, -0.5, 0.3]} speed={-0.3} />
      <Ring radius={2.6} color="#8b5cf6" tilt={[0.9, 0.7, -0.2]} speed={0.22} />
      {cards.map((c, i) => (
        <OrbitCard key={c.id} card={c} index={i} total={cards.length} onSelect={onSelect} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------------- */
/* Public component                                                           */
/* ------------------------------------------------------------------------- */

export default function HeroScene({ cards }: { cards: HeroCard[] }) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  // Pause the render loop entirely while the hero is scrolled out of view.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.4, 7.2], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={visible ? "always" : "never"}
        // Shown by r3f when WebGL is unavailable.
        fallback={null}
      >
        <Rig cards={cards} onSelect={(id) => router.push(`/listings/${id}`)} />
      </Canvas>
    </div>
  );
}
