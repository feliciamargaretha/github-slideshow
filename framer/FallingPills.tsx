import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType } from "framer"
// @ts-ignore – Framer resolves URL imports
import Matter from "https://esm.sh/matter-js@0.19.0"

type Pill = {
    label: string
    color: string
    textColor: string
    dashed?: boolean
}

const DEFAULT_PILLS: Pill[] = [
    { label: "Creative Directors", color: "#EE8AF5", textColor: "#5B1263" },
    { label: "UX Designers", color: "#EF7F4C", textColor: "#4A1A05" },
    { label: "Graphic Designers", color: "#F6CF6E", textColor: "#4A3405" },
    { label: "Architects", color: "#AFC3FB", textColor: "#1E2F7A" },
    { label: "Game Designers", color: "#D6FC7A", textColor: "#2E3D06" },
    { label: "Illustrators", color: "#7FDDA0", textColor: "#0F3D21" },
    { label: "+ your role", color: "#F3EFE6", textColor: "#6B625A", dashed: true },
]

const WALL = 400 // thick walls so fast pills can't tunnel through
const STEP = 1000 / 60
const CAT_PILL = 0x0001
const CAT_WALL = 0x0002
const CAT_CEILING = 0x0004

/**
 * Pills rain down from the top, pile up, and can be grabbed and flung around —
 * always staying inside the frame.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function FallingPills(props) {
    const {
        pills = DEFAULT_PILLS,
        background = "#3461D0",
        font,
        paddingX = 28,
        paddingY = 14,
        outlineColor = "#1E1E1E",
        outlineWidth = 1.5,
        shadowOffset = 5,
        gravity = 1,
        bounciness = 0.4,
        friction = 0.3,
        startDelay = 0.2,
        dropInterval = 0.25,
        startOnView = true,
        style,
    } = props

    const containerRef = useRef<HTMLDivElement>(null)
    const pillRefs = useRef<(HTMLDivElement | null)[]>([])

    const deps = JSON.stringify([pills, font, paddingX, paddingY, outlineWidth])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        const { Engine, Bodies, Body, Composite, Constraint, Query } = Matter

        let cancelled = false
        let started = false
        let raf = 0
        const timers: ReturnType<typeof setTimeout>[] = []

        const engine = Engine.create()
        engine.gravity.y = gravity
        const world = engine.world

        let W = container.offsetWidth
        let H = container.offsetHeight
        const items: { body: any; el: HTMLDivElement; w: number; h: number; inside: boolean }[] = []

        // ---------- walls ----------
        let walls: any[] = []
        const buildWalls = () => {
            if (walls.length) Composite.remove(world, walls)
            const wallOpts = (category: number) => ({
                isStatic: true,
                friction: 0.3,
                restitution: bounciness,
                collisionFilter: { category, mask: CAT_PILL },
            })
            const tall = H + WALL * 2 + 2000 // side walls reach high above the frame
            walls = [
                Bodies.rectangle(W / 2, H + WALL / 2, W + WALL * 2, WALL, wallOpts(CAT_WALL)), // floor
                Bodies.rectangle(-WALL / 2, H + WALL - tall / 2, WALL, tall, wallOpts(CAT_WALL)), // left
                Bodies.rectangle(W + WALL / 2, H + WALL - tall / 2, WALL, tall, wallOpts(CAT_WALL)), // right
                Bodies.rectangle(W / 2, -WALL / 2, W + WALL * 2, WALL, wallOpts(CAT_CEILING)), // ceiling
            ]
            Composite.add(world, walls)
        }
        buildWalls()

        // ---------- spawning ----------
        const spawn = (i: number) => {
            const el = pillRefs.current[i]
            if (!el || cancelled) return
            const w = el.offsetWidth
            const h = el.offsetHeight
            const x = w >= W ? W / 2 : w / 2 + Math.random() * (W - w)
            const y = -h - Math.random() * 40 // start just above the frame
            const body = Bodies.rectangle(x, y, w, h, {
                chamfer: { radius: Math.min(w, h) / 2 - 0.5 },
                angle: (Math.random() - 0.5) * 0.5,
                restitution: bounciness,
                friction,
                frictionAir: 0.01,
                density: 0.002,
                // Ignore the ceiling until the pill has fully entered the frame
                collisionFilter: { category: CAT_PILL, mask: CAT_PILL | CAT_WALL },
            })
            Body.setVelocity(body, { x: (Math.random() - 0.5) * 3, y: 2 })
            Composite.add(world, body)
            items.push({ body, el, w, h, inside: false })
            el.style.visibility = "visible"
        }

        const start = () => {
            if (started || cancelled) return
            started = true
            pills.forEach((_, i) => {
                timers.push(setTimeout(() => spawn(i), (startDelay + i * dropInterval) * 1000))
            })
        }

        // ---------- drag & fling ----------
        let drag: { constraint: any; pointerId: number } | null = null
        const toLocal = (e: PointerEvent) => {
            const r = container.getBoundingClientRect()
            const scale = r.width / container.offsetWidth || 1 // handles Framer canvas zoom
            return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
        }
        const clampToFrame = (p: { x: number; y: number }) => ({
            x: Math.max(0, Math.min(W, p.x)),
            y: Math.max(0, Math.min(H, p.y)),
        })
        const hit = (p: { x: number; y: number }) =>
            Query.point(
                items.map((it) => it.body),
                p
            )[0]

        const onDown = (e: PointerEvent) => {
            const p = toLocal(e)
            const body = hit(p)
            if (!body) return
            e.preventDefault()
            container.setPointerCapture(e.pointerId)
            const constraint = Constraint.create({
                pointA: p,
                bodyB: body,
                pointB: { x: p.x - body.position.x, y: p.y - body.position.y },
                stiffness: 0.2,
                damping: 0.05,
                length: 0,
            })
            Composite.add(world, constraint)
            drag = { constraint, pointerId: e.pointerId }
            container.style.cursor = "grabbing"
        }
        const onMove = (e: PointerEvent) => {
            const p = toLocal(e)
            if (drag && drag.pointerId === e.pointerId) {
                drag.constraint.pointA = clampToFrame(p)
            } else if (e.pointerType === "mouse") {
                container.style.cursor = hit(p) ? "grab" : ""
            }
        }
        const onUp = (e: PointerEvent) => {
            if (!drag || drag.pointerId !== e.pointerId) return
            Composite.remove(world, drag.constraint)
            drag = null
            container.style.cursor = hit(toLocal(e)) ? "grab" : ""
        }
        container.addEventListener("pointerdown", onDown)
        container.addEventListener("pointermove", onMove)
        container.addEventListener("pointerup", onUp)
        container.addEventListener("pointercancel", onUp)

        // ---------- loop ----------
        let last = performance.now()
        let acc = 0
        const MAX_SPEED = 45
        const tick = (now: number) => {
            acc += Math.min(now - last, 100)
            last = now
            while (acc >= STEP) {
                Engine.update(engine, STEP)
                acc -= STEP
            }
            for (const it of items) {
                const b = it.body
                // Turn on the ceiling once the pill is fully inside
                if (!it.inside && b.bounds.min.y > 0) {
                    it.inside = true
                    b.collisionFilter.mask = CAT_PILL | CAT_WALL | CAT_CEILING
                }
                // Speed limit + safety net in case anything ever escapes
                const v = b.velocity
                const speed = Math.hypot(v.x, v.y)
                if (speed > MAX_SPEED) Body.setVelocity(b, { x: (v.x / speed) * MAX_SPEED, y: (v.y / speed) * MAX_SPEED })
                const { x, y } = b.position
                if (x < -50 || x > W + 50 || y > H + 50 || (it.inside && y < -50)) {
                    Body.setPosition(b, { x: W / 2, y: it.h })
                    Body.setVelocity(b, { x: 0, y: 0 })
                }
                it.el.style.transform = `translate(${x - it.w / 2}px, ${y - it.h / 2}px) rotate(${b.angle}rad)`
            }
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)

        // ---------- resize ----------
        const ro = new ResizeObserver(() => {
            W = container.offsetWidth
            H = container.offsetHeight
            buildWalls()
        })
        ro.observe(container)

        // ---------- start (after fonts load so pill widths are right) ----------
        let io: IntersectionObserver | null = null
        const fontsReady = (document as any).fonts?.ready ?? Promise.resolve()
        fontsReady.then(() => {
            if (cancelled) return
            if (startOnView && "IntersectionObserver" in window) {
                io = new IntersectionObserver(
                    (entries) => {
                        if (entries.some((en) => en.isIntersecting)) {
                            start()
                            io?.disconnect()
                        }
                    },
                    { threshold: 0.3 }
                )
                io.observe(container)
            } else {
                start()
            }
        })

        return () => {
            cancelled = true
            cancelAnimationFrame(raf)
            timers.forEach(clearTimeout)
            ro.disconnect()
            io?.disconnect()
            container.removeEventListener("pointerdown", onDown)
            container.removeEventListener("pointermove", onMove)
            container.removeEventListener("pointerup", onUp)
            container.removeEventListener("pointercancel", onUp)
            Composite.clear(world, false)
            Engine.clear(engine)
            pillRefs.current.forEach((el) => el && (el.style.visibility = "hidden"))
        }
    }, [deps, gravity, bounciness, friction, startDelay, dropInterval, startOnView])

    return (
        <div
            ref={containerRef}
            style={{
                ...style,
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                background,
            }}
        >
            {pills.map((p: Pill, i: number) => (
                <div
                    key={i}
                    ref={(el) => (pillRefs.current[i] = el)}
                    style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        visibility: "hidden",
                        whiteSpace: "nowrap",
                        padding: `${paddingY}px ${paddingX}px`,
                        borderRadius: 999,
                        background: p.color,
                        color: p.textColor,
                        border: p.dashed
                            ? `${outlineWidth}px dashed rgba(0,0,0,0.35)`
                            : `${outlineWidth}px solid ${outlineColor}`,
                        boxShadow: p.dashed ? "none" : `${shadowOffset}px ${shadowOffset}px 0 ${outlineColor}`,
                        userSelect: "none",
                        WebkitUserSelect: "none",
                        touchAction: "none", // drag pills on touch, but still scroll the page on the background
                        willChange: "transform",
                        lineHeight: 1.2,
                        fontSize: 28,
                        fontWeight: 500,
                        ...font,
                    }}
                >
                    {p.label}
                </div>
            ))}
        </div>
    )
}

addPropertyControls(FallingPills, {
    pills: {
        type: ControlType.Array,
        title: "Pills",
        defaultValue: DEFAULT_PILLS,
        control: {
            type: ControlType.Object,
            controls: {
                label: { type: ControlType.String, defaultValue: "Role" },
                color: { type: ControlType.Color, defaultValue: "#F6CF6E" },
                textColor: { type: ControlType.Color, defaultValue: "#1E1E1E" },
                dashed: { type: ControlType.Boolean, defaultValue: false },
            },
        },
    },
    background: { type: ControlType.Color, defaultValue: "#3461D0" },
    font: {
        type: ControlType.Font,
        controls: "extended",
        defaultFontType: "sans-serif",
        defaultValue: { fontSize: 28 },
    },
    paddingX: { type: ControlType.Number, title: "Padding X", defaultValue: 28, min: 0, max: 80 },
    paddingY: { type: ControlType.Number, title: "Padding Y", defaultValue: 14, min: 0, max: 60 },
    outlineColor: { type: ControlType.Color, title: "Outline", defaultValue: "#1E1E1E" },
    outlineWidth: { type: ControlType.Number, title: "Outline W", defaultValue: 1.5, min: 0, max: 6, step: 0.5 },
    shadowOffset: { type: ControlType.Number, title: "Shadow", defaultValue: 5, min: 0, max: 20 },
    gravity: { type: ControlType.Number, defaultValue: 1, min: 0, max: 3, step: 0.1 },
    bounciness: { type: ControlType.Number, defaultValue: 0.4, min: 0, max: 1, step: 0.05 },
    friction: { type: ControlType.Number, defaultValue: 0.3, min: 0, max: 1, step: 0.05 },
    startDelay: { type: ControlType.Number, title: "Start Delay", defaultValue: 0.2, min: 0, max: 5, step: 0.1, unit: "s" },
    dropInterval: { type: ControlType.Number, title: "Drop Gap", defaultValue: 0.25, min: 0, max: 2, step: 0.05, unit: "s" },
    startOnView: { type: ControlType.Boolean, title: "Start In View", defaultValue: true },
})
