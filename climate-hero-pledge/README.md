# Rootwork landing header: Hectare

A third alternative to `../climate-hero/` and `../climate-hero-expedition/`. Here the action is the hero, and the headline supports it.

- **The plot:** one hectare drawn as a 100 × 100 grid, so each square is one square metre. A scale bar marks 10 m. Claimed squares are moss green. The ground comes back from one spot on a meandering channel and spreads outward, fastest along the water, so the plot fills like returning wetland rather than row by row. The fill order is fixed, so the same total always shows the same squares.
- **The tool:** pick 1, 10, 25 or 100 m². The plot outlines the squares your pledge would add, and the line under the choices says how big that is (for example, "a 5 × 5 m patch, about a living room"). "Restore 25 m²" adds the pledge. The confirmation says payment comes next. No card details are ever asked for, and there are no prices on the page, because the cost per square metre is the organisation's to set.
- **The count is real:**
  - In the Claude preview, every person's pledges are stored in a shared database: one document per person (`pledges/<their id>`), which only they can write. The total is the sum of everyone's documents, and it updates live for everyone viewing.
  - It starts at zero, and nothing is seeded.
  - People who can only view the page see the count but can't pledge.
  - Opened anywhere else (this repo, GitHub Pages, a saved file), there's no shared database, so pledges are kept in that browser only, and the page says so.
- **Hectares:** when a hectare is full, the next one starts empty and the counter moves to "hectare 2".
- **Type:** Bricolage Grotesque for the headline, Hanken Grotesk for the text, Martian Mono for the numbers. Dark, earthy colours, with moss green for restored ground and the one action.
- **Phones:** the headline, plot and tool stack, and the size choices go two-by-two on narrow phones.

The site name ("drained wetland") and all the copy are placeholders, like the rest of Rootwork.
