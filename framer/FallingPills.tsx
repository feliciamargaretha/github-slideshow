import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType } from "framer"

type Pill = {
    label: string
    color: string
    textColor: string
    row: number // 1 = bottom row
    tilt: number // degrees, positive = clockwise
    dashed?: boolean
}

const DEFAULT_PILLS: Pill[] = [
    { label: "Creative Directors", color: "#EE8AF5", textColor: "#5B1263", row: 1, tilt: 3 },
    { label: "UX Designers", color: "#EF7F4C", textColor: "#4A1A05", row: 1, tilt: -1 },
    { label: "Graphic Designers", color: "#F6CF6E", textColor: "#4A3405", row: 1, tilt: 1 },
    { label: "Architects", color: "#AFC3FB", textColor: "#1E2F7A", row: 2, tilt: -4 },
    { label: "Game Designers", color: "#D6FC7A", textColor: "#2E3D06", row: 2, tilt: 3 },
    { label: "Illustrators", color: "#7FDDA0", textColor: "#0F3D21", row: 3, tilt: 3 },
    { label: "+ your role", color: "#F3EFE6", textColor: "#6B625A", row: 4, tilt: 0, dashed: true },
]

const GAP = 2 // px between pills in a row

// Accelerate down, land, one small bounce
const fallCurve = (q: number) =>
    q < 0.72 ? (q / 0.72) ** 2 : 1 - 0.06 * Math.sin((Math.PI * (q - 0.72)) / 0.28)

type Target = { x: number; y: number; angle: number; w: number; h: number; hh: number }

/**
 * Role pills drop in one by one and land in their own place in a stack.
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
        fallDuration = 0.8,
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
        const els = pills.map((_, i) => pillRefs.current[i]).filter(Boolean) as HTMLDivElement[]
        if (els.length !== pills.length) return

        let cancelled = false
        let raf = 0
        let landed = false
        let targets: Target[] = []
        const baseFont = parseFloat(font?.fontSize) || 28

        // Measure pills, shrink them if the stack doesn't fit, and work out where each one lands
        const computeLayout = (W: number, H: number) => {
            const setScale = (s: number) =>
                els.forEach((el) => {
                    el.style.fontSize = `${baseFont * s}px`
                    el.style.padding = `${paddingY * s}px ${paddingX * s}px`
                })
            setScale(1)
            const rows: Record<number, number[]> = {}
            pills.forEach((p: Pill, i: number) => (rows[p.row || 1] ??= []).push(i))
            const rowKeys = Object.keys(rows).map(Number).sort((a, b) => a - b)
            const rowWidth = (r: number) =>
                rows[r].reduce((s, i) => s + els[i].offsetWidth, 0) + GAP * (rows[r].length - 1)
            const widest = Math.max(...rowKeys.map(rowWidth))
            const h0 = els[0].offsetHeight
            const scale = Math.min(1, (W - 12) / widest, (H - 12) / (rowKeys.length * h0 * 1.08))
            if (scale < 1) setScale(scale)

            const out: Target[] = []
            let prevTop = H
            rowKeys.forEach((r) => {
                const box = rows[r].map((i) => {
                    const w = els[i].offsetWidth
                    const h = els[i].offsetHeight
                    const a = ((pills[i].tilt || 0) * Math.PI) / 180
                    return {
                        i, w, h, a,
                        hw: (w * Math.cos(a) + h * Math.abs(Math.sin(a))) / 2,
                        hh: (w * Math.abs(Math.sin(a)) + h * Math.cos(a)) / 2,
                    }
                })
                const total = box.reduce((s, b) => s + b.hw * 2, 0) + GAP * (box.length - 1)
                const half = Math.max(...box.map((b) => (b.h / 2 + b.hh) / 2))
                const cy = prevTop - half
                let x = W / 2 - total / 2
                box.forEach((b) => {
                    out[b.i] = { x: x + b.hw, y: cy, angle: b.a, w: b.w, h: b.h, hh: b.hh }
                    x += b.hw * 2 + GAP
                })
                prevTop = cy - half
            })
            return out
        }

        const draw = (el: HTMLDivElement, x: number, y: number, t: Target, a: number) => {
            el.style.transform = `translate(${x - t.w / 2}px, ${y - t.h / 2}px) rotate(${a}rad)`
        }
        const placeAll = () =>
            targets.forEach((t, i) => {
                els[i].style.visibility = "visible"
                draw(els[i], t.x, t.y, t, t.angle)
            })

        const start = () => {
            if (cancelled) return
            targets = computeLayout(container.offsetWidth, container.offsetHeight)
            const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
            if (reduceMotion) {
                landed = true
                placeAll()
                return
            }
            const order = pills.map((_, i) => i).sort((a, b) => (pills[a].row || 1) - (pills[b].row || 1))
            const startAngles = pills.map(() => (Math.random() - 0.5) * 0.6)
            const t0 = performance.now()
            const tick = (now: number) => {
                let done = true
                order.forEach((i, k) => {
                    const p = (now - t0 - (startDelay + k * dropInterval) * 1000) / (fallDuration * 1000)
                    if (p < 1) done = false
                    if (p < 0) return
                    const q = Math.min(1, p)
                    const t = targets[i]
                    const y0 = -t.hh - 10 // start just above the frame
                    const a = startAngles[i] + (t.angle - startAngles[i]) * (1 - (1 - q) ** 3)
                    els[i].style.visibility = "visible"
                    draw(els[i], t.x, y0 + (t.y - y0) * fallCurve(q), t, a)
                })
                if (done) landed = true
                else raf = requestAnimationFrame(tick)
            }
            raf = requestAnimationFrame(tick)
        }

        // Keep the landed stack centred if the frame changes size
        let lastW = container.offsetWidth
        let lastH = container.offsetHeight
        const ro = new ResizeObserver(() => {
            const W = container.offsetWidth
            const H = container.offsetHeight
            if (W === lastW && H === lastH) return
            lastW = W
            lastH = H
            if (landed) {
                targets = computeLayout(W, H)
                placeAll()
            }
        })
        ro.observe(container)

        // Start after fonts load (so pill widths are right), optionally when scrolled into view
        let io: IntersectionObserver | null = null
        const fontsReady = (document as any).fonts?.ready ?? Promise.resolve()
        fontsReady.then(() => {
            if (cancelled) return
            if (startOnView && "IntersectionObserver" in window) {
                io = new IntersectionObserver(
                    (entries) => {
                        if (entries.some((en) => en.isIntersecting)) {
                            io?.disconnect()
                            start()
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
            ro.disconnect()
            io?.disconnect()
            els.forEach((el) => (el.style.visibility = "hidden"))
        }
    }, [deps, fallDuration, startDelay, dropInterval, startOnView])

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
                        willChange: "transform",
                        lineHeight: 1.2,
                        fontWeight: 500,
                        ...font,
                        fontSize: parseFloat(font?.fontSize) || 28,
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
                row: { type: ControlType.Number, title: "Row (1 = bottom)", defaultValue: 1, min: 1, max: 10, step: 1, displayStepper: true },
                tilt: { type: ControlType.Number, title: "Tilt", defaultValue: 0, min: -20, max: 20, step: 0.5, unit: "°" },
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
    fallDuration: { type: ControlType.Number, title: "Fall Time", defaultValue: 0.8, min: 0.2, max: 3, step: 0.1, unit: "s" },
    startDelay: { type: ControlType.Number, title: "Start Delay", defaultValue: 0.2, min: 0, max: 5, step: 0.1, unit: "s" },
    dropInterval: { type: ControlType.Number, title: "Drop Gap", defaultValue: 0.25, min: 0, max: 2, step: 0.05, unit: "s" },
    startOnView: { type: ControlType.Boolean, title: "Start In View", defaultValue: true },
})
