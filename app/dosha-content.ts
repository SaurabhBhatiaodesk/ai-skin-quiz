// PRANA Deep Dosha Diagnostic content and rules, taken from "PRANA_Quiz_Dosha_Content_updated" (Oct 2026):
// the scoring thresholds, the seven result profiles (signature, allies, signs, ritual, product usage guide) and the
// ritual product lists for each result. Result keys use the app's profile keys.

export type DoshaResultKey = "vata" | "pitta" | "kapha" | "balanced" | "dual-vata-pitta" | "dual-vata-kapha" | "dual-kapha-pitta";

export const DOSHA_THRESHOLDS = { singleMin: 12, dualPairMin: 15, dualEachMin: 5, triMin: 5, triMax: 7, questionCount: 18 };

// Spec product handles and names. Store products are matched by handle first, then by name.
export const RITUAL_PRODUCTS: Record<string, string> = {
  "rose-jasmine-milk-cleanser": "Rose Jasmine Milk Cleanser",
  "rose-water-toning-mist": "Pure Rose Water Toning Mist",
  "saffron-glow-serum": "PRANA Saffron Glow Serum",
  "bakuchiol-night-serum": "Bakuchiol Night Restorative Serum",
  "saffron-radiance-moisturizer": "Saffron Radiance Moisturizer",
  "turmeric-sandalwood-mask": "Turmeric & Sandalwood Purifying Mask",
};

export const FREQUENCY_LABELS: Record<string, string> = { every_2_weeks: "Once every 2 weeks", weekly: "Once a week", "1_to_2_per_week": "1–2 times a week" };

export type DoshaUsage = { product: string; when: string; how: string };
export type DoshaContent = {
  displayName: string;
  element: string;
  tagline: string;
  signature: string;
  allies: string[];
  profile: string;
  balance: string[];
  imbalance: string[];
  seasonal: string[];
  ritual: { morning: string; night: string; weekly: string; key: string };
  usage: DoshaUsage[];
  products: { morning: string[]; night: string[]; optional: string[]; weekly: { product: string; frequency: string } };
  notes: string;
};

const C = "rose-jasmine-milk-cleanser", M = "rose-water-toning-mist", S = "saffron-glow-serum", B = "bakuchiol-night-serum", R = "saffron-radiance-moisturizer", K = "turmeric-sandalwood-mask";

export const DOSHA_CONTENT: Record<DoshaResultKey, DoshaContent> = {
  vata: {
    displayName: "Vata",
    element: "Air & Space · The energy of movement",
    tagline: "Your skin carries the poetry of movement.",
    signature: "Fine-pored, delicate, and expressive — Vata skin holds emotion visibly. At its best, it has a translucent, almost porcelain quality. It is quick to respond to change — in weather, in seasons, in your own inner landscape. When Vata is in balance, there is lightness and luminosity. When disturbed, the skin tightens, dulls, and dehydrates faster than any other constitution.",
    allies: ["Kashmir Saffron", "Kokum Butter", "Shea Butter", "Rose Damascena"],
    profile: "Vata skin is the most delicate of the three constitutions and the fastest to reflect internal imbalance. Characterised by fine pores, a tendency toward dryness, and visible sensitivity, Vata skin requires deep nourishment and consistent barrier support above all else.",
    balance: ["Translucent, luminous quality with a natural glow", "Fine texture — pores almost invisible", "Skin feels supple and hydrated through the day"],
    imbalance: ["Tightness, flakiness, and dehydration — especially forehead and cheeks", "Fine lines more visible — skin loses plumpness quickly", "Dullness and uneven tone — skin appears tired or flat", "Heightened sensitivity — reactive to wind, cold, and air travel"],
    seasonal: [],
    ritual: {
      morning: "Rose Jasmine Milk Cleanser → Pure Rose Water Toning Mist → PRANA Saffron Glow Serum → Saffron Radiance Moisturizer",
      night: "Rose Jasmine Milk Cleanser → Bakuchiol Night Restorative Serum → Saffron Radiance Moisturizer",
      weekly: "Turmeric & Sandalwood Purifying Mask (limit to bi-weekly — Vata skin benefits from gentle clay use)",
      key: "Sesame oil base in the PRANA Saffron Glow Serum is the canonical Vata pacifying carrier — Charaka Samhita identifies it as the deepest penetrating oil, reaching all seven dhatus",
    },
    usage: [
      { product: "Rose Jasmine Milk Cleanser", when: "Morning & night, daily", how: "Massage gently onto skin for 30–60 seconds and remove with lukewarm water or a soft damp cloth. Avoid hot water, which strips Vata skin fastest. Pat dry." },
      { product: "Pure Rose Water Toning Mist", when: "Morning & night, plus through the day", how: "Mist generously while skin is still damp from cleansing. Re-mist during the day, especially in dry air, wind, or on flights, and always follow with serum or moisturizer to seal it in." },
      { product: "PRANA Saffron Glow Serum", when: "Morning & night, daily", how: "Warm 3–4 drops between the palms and press into damp skin. At night, use it under the moisturizer or mix 1–2 drops into it — Vata skin benefits from oil twice a day." },
      { product: "Bakuchiol Night Restorative Serum", when: "Night — every other night for 2 weeks, then nightly", how: "Apply a thin layer after the mist, before moisturizer. Helps soften the look of fine lines without the dryness of retinol." },
      { product: "Saffron Radiance Moisturizer", when: "Morning & night, daily", how: "Apply a generous layer while the serum is still slightly damp. In cold, windy weather, add a second thin layer to the cheeks." },
      { product: "Turmeric & Sandalwood Purifying Mask", when: "Once every two weeks", how: "Apply a thin layer and rinse with lukewarm water before the clay fully dries. Follow straight away with mist, serum, and moisturizer." },
    ],
    products: { morning: [C, M, S, R], night: [C, M, B, S, R], optional: [], weekly: { product: K, frequency: "every_2_weeks" } },
    notes: "Serum twice daily; never hot water.",
  },
  pitta: {
    displayName: "Pitta",
    element: "Fire & Water · The energy of transformation",
    tagline: "Your skin is intelligent. It knows exactly what it needs — and makes itself heard.",
    signature: "Warm, luminous, and intelligent — Pitta skin is beautiful when balanced and unmistakable when it isn't. It tends toward warmth, even flushing, with a natural radiance that can tip into redness or reactivity under stress, heat, or the wrong ingredients. Pitta skin responds quickly to treatment — for better and for worse.",
    allies: ["Rosa Damascena", "Turmeric Curcumin", "Sandalwood", "Saffron Safranal"],
    profile: "Pitta skin has a natural warmth and luminosity that is immediately visible. Medium-pored, combination to normal in texture, Pitta skin is the most responsive to active ingredients — making it the ideal candidate for brightening and anti-inflammatory formulas, and the most susceptible to irritation from harsh synthetic actives.",
    balance: ["Warm, even complexion with natural radiance — a healthy flush", "Medium pores, smooth texture, combination to normal oil balance", "Responds quickly and visibly to skincare — results appear fast"],
    imbalance: ["Redness, flushing, or rosacea-like sensitivity — heat rising to the surface", "Inflamed breakouts, often cystic or clustered around the jaw and cheeks", "Hyperpigmentation or post-inflammatory marks that are slow to resolve", "Sunburn and UV sensitivity — Pitta skin is the most sun-vulnerable constitution"],
    seasonal: [],
    ritual: {
      morning: "Rose Jasmine Milk Cleanser → Pure Rose Water Toning Mist → Saffron Glow Serum (focus on the Manjistha and Saffron — both are Pitta-cooling Varnya herbs) → Saffron Radiance Moisturizer",
      night: "Rose Jasmine Milk Cleanser → Bakuchiol Night Restorative Serum (retinol-free, no irritation risk) → Saffron Radiance Moisturizer",
      weekly: "Turmeric & Sandalwood Purifying Mask — Turmeric's curcumin is anti-inflammatory, Sandalwood is a classical Pitta-cooling herb",
      key: "Avoid synthetic fragrances, AHAs, and harsh actives — Pitta skin reacts to chemical irritants faster than any other constitution",
    },
    usage: [
      { product: "Rose Jasmine Milk Cleanser", when: "Morning & night, daily", how: "Massage gently for 30–60 seconds and rinse with cool to lukewarm water. No scrubbing or hot water, both of which bring heat to the surface." },
      { product: "Pure Rose Water Toning Mist", when: "Morning & night, plus through the day", how: "Mist after cleansing and whenever skin feels hot or flushed — after sun, exercise, or stress. Keep it chilled in summer for extra cooling." },
      { product: "PRANA Saffron Glow Serum", when: "Every morning", how: "Press 3 drops into damp skin, focusing on redness, uneven tone, and post-breakout marks." },
      { product: "Bakuchiol Night Restorative Serum", when: "Night — every other night for 2 weeks, then nightly", how: "Apply after cleansing and misting. Retinol-free, so it brings renewal without irritation. Pause for a few nights during a flare, then resume." },
      { product: "Saffron Radiance Moisturizer", when: "Morning & night, daily", how: "A light, even layer. In hot weather, use less in the morning and keep the full layer for night." },
      { product: "Turmeric & Sandalwood Purifying Mask", when: "Once a week", how: "Apply evenly and rinse with cool water. Turmeric calms inflammation and Sandalwood cools — ideal after a day in the sun or heat (skip on sunburnt or broken skin)." },
    ],
    products: { morning: [C, M, S, R], night: [C, M, B, R], optional: [], weekly: { product: K, frequency: "weekly" } },
    notes: "Cooling focus; skip mask on sunburnt skin.",
  },
  kapha: {
    displayName: "Kapha",
    element: "Earth & Water · The energy of structure",
    tagline: "Thick, stable, and slow to age — Kapha skin is a long game that pays extraordinary dividends.",
    signature: "Kapha skin is the most durable and structurally rich constitution. Thick, well-lubricated, and slow to develop fine lines — Kapha skin often looks younger than its age for decades. The challenge is not aging but congestion: blocked pores, sluggish circulation, excess sebum, and a tendency toward dullness when the energy of structure tips into stagnation.",
    allies: ["Turmeric", "Bentonite Clay", "French Pink Clay", "Kashmir Saffron"],
    profile: "Kapha skin ages the most gracefully of the three constitutions — but requires the most stimulation. Where Vata needs nourishment and Pitta needs cooling, Kapha needs movement: ingredients that awaken circulation, clarify pores, and lift the energetic density that accumulates in this constitution.",
    balance: ["Thick, well-hydrated skin with visible structural integrity — plump and resilient", "Slow to develop fine lines or wrinkles — exceptional anti-aging baseline", "Calm, stable complexion — rarely reactive or inflamed"],
    imbalance: ["Excess sebum — skin feels congested, oily at midday, prone to blackheads", "Enlarged pores — particularly across the nose and chin", "Dullness and greyness — skin lacks luminosity despite good hydration", "Puffiness or water retention — especially under the eyes and along the jaw"],
    seasonal: [],
    ritual: {
      morning: "Rose Jasmine Milk Cleanser (emulsifying action lifts overnight sebum) → Pure Rose Water Toning Mist → PRANA Saffron Glow Serum (saffron's tyrosinase inhibition brightens dull Kapha tone)",
      night: "Rose Jasmine Milk Cleanser → Bakuchiol Night Restorative Serum — Kapha skin often does not need a heavy night cream",
      weekly: "Turmeric & Sandalwood Purifying Mask — this is the cornerstone Kapha treatment. Three-clay formula (Bentonite, French Pink Clay, Kaolin) draws out excess sebum and congestion. Use up to 2x weekly if skin tolerates",
      key: "Massage technique matters — Abhyanga application with upward circular strokes stimulates the lymphatic drainage that Kapha skin needs to clear",
    },
    usage: [
      { product: "Rose Jasmine Milk Cleanser", when: "Morning & night, daily", how: "Massage for about 60 seconds with upward circular strokes to lift sebum and wake circulation. Rinse with warm water." },
      { product: "Pure Rose Water Toning Mist", when: "Morning & night, daily", how: "Mist after cleansing to refresh and prep the skin for serum." },
      { product: "PRANA Saffron Glow Serum", when: "Every morning", how: "2–3 drops massaged in with brisk upward strokes (Abhyanga), working from the jaw toward the ears and up the forehead. Brightens dull, flat tone." },
      { product: "Bakuchiol Night Restorative Serum", when: "Every night", how: "The main night step and usually the only product needed after cleansing. Supports clearer pores and smoother texture." },
      { product: "Saffron Radiance Moisturizer", when: "Only as needed", how: "Most Kapha skin doesn't need it daily. Use a small amount on any dry areas, or nightly in cold, dry winter weather." },
      { product: "Turmeric & Sandalwood Purifying Mask", when: "Once or twice a week", how: "The cornerstone treatment. Apply to the full face, focusing on the nose, chin, and congested areas. Rinse with warm water using circular motions." },
    ],
    products: { morning: [C, M, S], night: [C, M, B], optional: [R], weekly: { product: K, frequency: "1_to_2_per_week" } },
    notes: "Moisturizer only on dry areas or in winter.",
  },
  balanced: {
    displayName: "Tridoshic",
    element: "Vata · Pitta · Kapha — in rare balance",
    tagline: "The rarest constitution. All three energies in equilibrium.",
    signature: "Tridoshic skin is the most resilient and adaptable constitution in Ayurveda — all three energies present in relative equilibrium. Your skin shifts with the seasons rather than following a fixed pattern. In summer it may express Pitta. In autumn and winter, Vata. In spring, Kapha. The gift is adaptability. The practice is attention.",
    allies: ["Rosa Damascena", "Kashmir Saffron", "Bakuchiol", "Turmeric"],
    profile: "Tridoshic skin is the rarest outcome in Ayurvedic assessment. All three doshas are present in relative balance, which means the skin does not have a dominant constitutional pattern — it responds instead to the dominant external influence at any given time. Seasonal adjustment is the primary practice for Tridoshic skin.",
    balance: [],
    imbalance: [],
    seasonal: [
      "Autumn / Winter (Vata season): Lean into nourishing, oil-rich formulas — Saffron Glow Serum and Saffron Radiance Moisturizer as anchors",
      "Summer (Pitta season): Prioritise the Rose water toning step, cooling Sandalwood actives in the serum, and weekly turmeric mask for anti-inflammatory action",
      "Spring (Kapha season): Increase frequency of the Turmeric & Sandalwood Mask — clarifying and brightening is the seasonal priority",
    ],
    ritual: {
      morning: "Rose Jasmine Milk Cleanser → Pure Rose Water Toning Mist → PRANA Saffron Glow Serum → Saffron Radiance Moisturizer",
      night: "Rose Jasmine Milk Cleanser → Bakuchiol Night Restorative Serum → Saffron Radiance Moisturizer (as needed)",
      weekly: "Turmeric & Sandalwood Purifying Mask — universally balancing across all three doshas",
      key: "The full six-product ritual is designed for Tridoshic balance — each product serves a different dosha. The complete system is the Tridoshic prescription",
    },
    usage: [
      { product: "Rose Jasmine Milk Cleanser", when: "Morning & night, daily", how: "Massage for 30–60 seconds and rinse with lukewarm water — a gentle cleanse that suits every season." },
      { product: "Pure Rose Water Toning Mist", when: "Morning & night, daily", how: "Mist after cleansing. In summer, use it through the day as well to keep skin cool." },
      { product: "PRANA Saffron Glow Serum", when: "Every morning; nights too in autumn / winter", how: "3 drops pressed into damp skin. Add a night application in the colder, drier months when Vata rises." },
      { product: "Bakuchiol Night Restorative Serum", when: "Night — every other night for 2 weeks, then nightly", how: "Apply after cleansing and misting, before moisturizer. Suits balanced skin year-round." },
      { product: "Saffron Radiance Moisturizer", when: "Morning daily; night as needed", how: "A full layer in autumn and winter, a lighter layer in summer, and minimal in spring. Let the skin's feel guide the amount." },
      { product: "Turmeric & Sandalwood Purifying Mask", when: "Once a week; up to twice in spring", how: "Apply evenly and rinse before the clay fully dries. Use more often in spring (Kapha season) and less in winter if skin feels dry." },
    ],
    products: { morning: [C, M, S, R], night: [C, M, B, R], optional: [], weekly: { product: K, frequency: "weekly" } },
    notes: "Adjust by season: serum at night in autumn/winter; mask 2x/week in spring.",
  },
  "dual-vata-pitta": {
    displayName: "Vata · Pitta",
    element: "Air & Fire · The energy of movement and transformation",
    tagline: "Delicate, quick, and luminous — your skin feels everything first.",
    signature: "Vata-Pitta skin pairs the delicacy of Air with the heat of Fire. It is fine-textured and luminous, quick to respond, and quick to tell you when something is wrong. Dryness and redness can arrive together — tight, thirsty cheeks alongside flushing or a reactive patch. In balance, the skin has a fine, lit-from-within glow. Out of balance, it becomes the most sensitive combination in Ayurveda — easily dehydrated, easily inflamed.",
    allies: ["Rosa Damascena", "Kashmir Saffron", "Kokum Butter", "Sandalwood"],
    profile: "Vata-Pitta is a dual constitution — Vata and Pitta lead together, with Kapha in the background. The two doshas share lightness and intensity, which is why this skin tends to be fine, sensitive, and fast-reacting. The guiding principle is to nourish without heating: Vata asks for oil and warmth, Pitta asks for cooling and calm, so the ritual relies on gentle, cool-to-neutral nourishment and avoids anything harsh, stripping, or heating.",
    balance: ["Fine, smooth texture with a soft, translucent radiance", "Comfortable through the day — neither tight nor flushed", "Even tone with a gentle natural warmth in the cheeks"],
    imbalance: ["Dryness and redness at the same time — tight, flaky cheeks with flushing or heat", "Sensitivity to wind, sun, and new products — stinging or sudden reactivity", "Dehydration lines alongside inflamed spots or post-inflammatory marks", "Flare-ups linked to stress, travel, poor sleep, or skipped meals"],
    seasonal: [
      "Summer (Pitta season): Lean on cooling — Pure Rose Water Toning Mist through the day, weekly Turmeric & Sandalwood Mask, a lighter layer of moisturizer",
      "Autumn / early winter (Vata season): Lean on nourishment — Saffron Glow Serum and Saffron Radiance Moisturizer as anchors, morning and night",
      "Late summer into autumn: The most vulnerable window for this constitution — keep the ritual consistent and avoid introducing new products",
    ],
    ritual: {
      morning: "Rose Jasmine Milk Cleanser → Pure Rose Water Toning Mist → PRANA Saffron Glow Serum (Manjistha and Saffron calm Pitta while the sesame oil base nourishes Vata) → Saffron Radiance Moisturizer",
      night: "Rose Jasmine Milk Cleanser → Bakuchiol Night Restorative Serum (retinol-free, gentle on sensitive skin) → Saffron Radiance Moisturizer",
      weekly: "Turmeric & Sandalwood Purifying Mask, limited to bi-weekly — rinse before the clay fully dries and follow straight away with the Rose Water Mist and moisturizer",
      key: "Avoid hot water, harsh exfoliants, AHAs, and synthetic fragrance. Lukewarm water and a pressing (not rubbing) application suit both doshas",
    },
    usage: [
      { product: "Rose Jasmine Milk Cleanser", when: "Morning & night, daily", how: "Massage onto skin with fingertips for 30–60 seconds, then remove with lukewarm water or a soft damp cloth. Never use hot water and never scrub — pat skin dry." },
      { product: "Pure Rose Water Toning Mist", when: "Morning & night, plus through the day", how: "Mist straight after cleansing, while skin is still damp, so the serum absorbs better. Re-mist during heat, after sun, or on flights to cool flushing and top up hydration." },
      { product: "PRANA Saffron Glow Serum", when: "Every morning; nights too in autumn / winter", how: "Warm 3–4 drops between the palms and press (don't rub) into damp skin. In Vata season, mix 1–2 drops into the night moisturizer for extra nourishment." },
      { product: "Bakuchiol Night Restorative Serum", when: "Night — every other night for 2 weeks, then nightly", how: "Apply a thin layer after the mist, before moisturizer. Retinol-free, so it suits reactive skin. Pause for a few nights during a redness flare, then resume." },
      { product: "Saffron Radiance Moisturizer", when: "Morning & night, daily", how: "Seal in while the serum is still slightly damp. Use a full layer on dry cheeks; go thinner on flushed or breakout-prone areas in summer." },
      { product: "Turmeric & Sandalwood Purifying Mask", when: "Once every two weeks", how: "Apply a thin layer, avoiding flaky or windburned patches. Rinse with lukewarm water before the clay fully dries, then mist and moisturize straight away." },
    ],
    products: { morning: [C, M, S, R], night: [C, M, B, R], optional: [], weekly: { product: K, frequency: "every_2_weeks" } },
    notes: "Gentle: press, don't rub; lukewarm water only.",
  },
  "dual-vata-kapha": {
    displayName: "Vata · Kapha",
    element: "Air & Earth · The energy of movement and structure",
    tagline: "Cool by nature — warmth and circulation are your ritual.",
    signature: "Vata-Kapha skin is cool to the touch and quietly changeable. The two doshas share coldness but sit at opposite ends of moisture — Vata dry, Kapha oily — so this skin often shows both at once: delicate, dry cheeks with a congested T-zone, or winter dryness that turns to congestion in spring. In balance, the skin is soft, smooth, and clear. Out of balance, it turns dull, pale, and sluggish, with dryness and blocked pores side by side.",
    allies: ["Kashmir Saffron", "Turmeric", "Sesame Oil", "French Pink Clay"],
    profile: "Vata-Kapha is a dual constitution — Vata and Kapha lead together, with Pitta, the fire, in the background. Their shared quality is cold, so what this skin needs most is warmth: warming ingredients, circulation-boosting massage, and gentle stimulation. The ritual treats zones differently — nourish where the skin is dry, clarify where it is congested.",
    balance: ["Soft, smooth texture with a calm, even complexion", "Clear pores and a healthy, rosy warmth", "Stays comfortable through seasonal change"],
    imbalance: ["Dull, pale, or greyish tone — skin looks tired even after rest", "Dry, tight cheeks alongside congestion or blackheads on the nose and chin", "Morning puffiness and blemishes that are slow to heal", "Sensitivity to cold, damp, and wind — skin worsens through the colder months"],
    seasonal: [
      "Autumn / early winter (Vata season): Prioritise nourishment — Saffron Glow Serum and Saffron Radiance Moisturizer morning and night",
      "Late winter / spring (Kapha season): Shift to clarifying — Turmeric & Sandalwood Mask on the T-zone, a lighter layer of moisturizer",
      "Summer: Often the best season for this constitution — the warmth balances both doshas, so the ritual can stay simple",
    ],
    ritual: {
      morning: "Rose Jasmine Milk Cleanser → Pure Rose Water Toning Mist → PRANA Saffron Glow Serum (saffron brightens dull, cool-toned skin; the sesame oil base is warming) → Saffron Radiance Moisturizer (lighter on the T-zone)",
      night: "Rose Jasmine Milk Cleanser → Bakuchiol Night Restorative Serum → Saffron Radiance Moisturizer on dry areas only",
      weekly: "Turmeric & Sandalwood Purifying Mask on the T-zone and congested areas, skipping dry cheeks — once weekly, rising to twice weekly in spring if skin tolerates",
      key: "Warmth and movement — use lukewarm water and massage the serum in with brisk upward circular strokes (Abhyanga) to wake circulation without drying the skin",
    },
    usage: [
      { product: "Rose Jasmine Milk Cleanser", when: "Morning & night, daily", how: "Massage for about 60 seconds with upward strokes to wake circulation, spending extra time on the T-zone. Remove with warm (not hot) water." },
      { product: "Pure Rose Water Toning Mist", when: "Morning & night, daily", how: "Mist after cleansing. In winter, mist into the palms and press onto the face so the skin isn't chilled." },
      { product: "PRANA Saffron Glow Serum", when: "Every morning; nights too in autumn / winter", how: "3–4 drops massaged in with brisk upward circular strokes (Abhyanga) for about a minute. Focus on dull, pale areas to bring warmth and glow." },
      { product: "Bakuchiol Night Restorative Serum", when: "Night — every other night for 2 weeks, then nightly", how: "Apply to the whole face after cleansing. Supports smoother texture and clearer pores without drying out dry zones." },
      { product: "Saffron Radiance Moisturizer", when: "Morning all over; night on dry areas only", how: "Full layer on cheeks and around the eyes, a light veil on the T-zone. In spring, use on the cheeks only." },
      { product: "Turmeric & Sandalwood Purifying Mask", when: "Once a week; up to twice a week in spring", how: "Multi-mask: apply the clay to the T-zone and congested areas only, and skip dry cheeks (or use a very thin layer). Rinse with warm water, then moisturize the cheeks." },
    ],
    products: { morning: [C, M, S, R], night: [C, M, B, R], optional: [], weekly: { product: K, frequency: "weekly" } },
    notes: "Night moisturizer on dry areas only; mask on T-zone only, up to 2x/week in spring.",
  },
  "dual-kapha-pitta": {
    displayName: "Pitta · Kapha",
    element: "Fire & Earth · The energy of transformation and structure",
    tagline: "Strong, resilient skin that runs warm — clarity and cooling are your ritual.",
    signature: "Pitta-Kapha skin combines the heat of Fire with the density of Earth, joined by the Water they share. It is the most robust of the dual constitutions — well-hydrated, resilient, and slow to show age. The challenge is heat meeting oil: excess sebum, enlarged pores, and inflamed breakouts that can sit deep and linger. In balance, the skin is smooth, warm, and glowing. Out of balance, it turns oily, congested, and red at the same time.",
    allies: ["Turmeric Curcumin", "Sandalwood", "Manjistha", "Bentonite Clay"],
    profile: "Pitta-Kapha is a dual constitution — Pitta and Kapha lead together, with Vata in the background. Both doshas carry oil and moisture, so this skin rarely lacks hydration; it lacks clarity and coolness. The ritual is built on light textures, cooling botanicals, and regular clarifying, while avoiding heavy occlusives and anything heating.",
    balance: ["Smooth, plump, well-hydrated skin with a warm, healthy glow", "Slow to develop fine lines — strong, resilient structure", "Balanced oil — a natural sheen rather than shine"],
    imbalance: ["Oiliness and congestion — shiny by midday, enlarged pores across the nose, chin, and forehead", "Inflamed, deep, or cystic breakouts that are slow to clear", "Redness or heat over congested areas, often leaving post-inflammatory marks", "Puffiness or a heavy, dull look when Kapha takes the lead"],
    seasonal: [
      "Spring (Kapha season): Clarify — increase the Turmeric & Sandalwood Mask to twice weekly and keep moisturizer to a minimum",
      "Summer (Pitta season): Cool — Pure Rose Water Toning Mist through the day, and limit sun and heat exposure",
      "Autumn / winter: Usually the calmest period — add the Saffron Radiance Moisturizer at night if skin feels tight",
    ],
    ritual: {
      morning: "Rose Jasmine Milk Cleanser (lifts overnight sebum) → Pure Rose Water Toning Mist → PRANA Saffron Glow Serum (Manjistha and Saffron are Pitta-cooling Varnya herbs) → moisturizer only if needed",
      night: "Rose Jasmine Milk Cleanser → Bakuchiol Night Restorative Serum — Pitta-Kapha skin rarely needs a heavy night cream",
      weekly: "Turmeric & Sandalwood Purifying Mask — the cornerstone treatment. The three-clay formula clears Kapha congestion while Turmeric and Sandalwood cool Pitta inflammation. Use up to 2x weekly",
      key: "Light, cool, and clarifying — avoid heavy butters, very hot water, and synthetic fragrance. Never pick at inflamed breakouts; Pitta-Kapha marks are slow to fade",
    },
    usage: [
      { product: "Rose Jasmine Milk Cleanser", when: "Morning & night, daily", how: "Lifts overnight sebum and daytime build-up. Rinse with cool to lukewarm water. After heavy sweating or a long day, cleanse twice at night." },
      { product: "Pure Rose Water Toning Mist", when: "Morning & night, plus through the day", how: "Mist after cleansing and whenever skin feels hot or shiny — it cools and refreshes without adding oil. Keep it chilled in summer for extra cooling." },
      { product: "PRANA Saffron Glow Serum", when: "Every morning", how: "2–3 drops is enough for this skin type. Press into the skin, focusing on redness, dull patches, and post-breakout marks." },
      { product: "Bakuchiol Night Restorative Serum", when: "Every night", how: "The key night step and often the only product needed after cleansing. Supports smoother texture, clearer pores, and fading of post-breakout marks." },
      { product: "Saffron Radiance Moisturizer", when: "Only as needed", how: "Most days, skip it or use a pea-sized amount on dry areas only. Add it nightly in autumn and winter if skin feels tight." },
      { product: "Turmeric & Sandalwood Purifying Mask", when: "Once or twice a week", how: "The cornerstone treatment. Apply to the full face or focus on the T-zone and congested areas. Rinse with cool water, pressing gently over inflamed spots rather than scrubbing." },
    ],
    products: { morning: [C, M, S], night: [C, M, B], optional: [R], weekly: { product: K, frequency: "1_to_2_per_week" } },
    notes: "Light textures; moisturizer only as needed.",
  },
};

export type DoshaCounts = { vata: number; pitta: number; kapha: number };

// The spec's five rules, checked in order; every possible set of answers returns exactly one result.
// With a question count other than 18 the thresholds scale with it.
export function doshaFromCounts(counts: DoshaCounts, thresholds = DOSHA_THRESHOLDS): DoshaResultKey {
  const total = counts.vata + counts.pitta + counts.kapha;
  const scale = total && total !== thresholds.questionCount ? total / thresholds.questionCount : 1;
  const single = Math.ceil(thresholds.singleMin * scale), pair = Math.ceil(thresholds.dualPairMin * scale), each = Math.ceil(thresholds.dualEachMin * scale);
  const triMin = Math.floor(thresholds.triMin * scale), triMax = Math.ceil(thresholds.triMax * scale);
  const doshas = ["vata", "pitta", "kapha"] as const;
  if (!total) return "balanced";
  for (const dosha of doshas) if (counts[dosha] >= single) return dosha;
  const dualKey = (x: string, y: string) => (x === "vata" && y === "pitta" ? "dual-vata-pitta" : x === "vata" && y === "kapha" ? "dual-vata-kapha" : "dual-kapha-pitta") as DoshaResultKey;
  for (const [x, y] of [["vata", "pitta"], ["vata", "kapha"], ["pitta", "kapha"]] as const) {
    if (counts[x] >= each && counts[y] >= each && counts[x] + counts[y] >= pair) return dualKey(x, y);
  }
  if (doshas.every(dosha => counts[dosha] >= triMin && counts[dosha] <= triMax)) return "balanced";
  const top = Math.max(counts.vata, counts.pitta, counts.kapha);
  const leaders = doshas.filter(dosha => counts[dosha] === top);
  if (leaders.length === 1) return leaders[0];
  if (leaders.length === 3) return "balanced";
  return dualKey(leaders[0], leaders[1]);
}

// The 18 Deep Dosha Diagnostic questions from the spec: answer A = Vata, B = Pitta, C = Kapha, one point each.
const PRAKRITI = "Prakriti · Your baseline nature", VIKRITI = "Vikriti · Your current state", ENVIRONMENT = "Environment · External influences";
const Q = (layer: number, phase: string, text: string, a: string, b: string, c: string) => ({
  layer, phase, text, sub: "",
  options: [[a, { V: 1 }], [b, { P: 1 }], [c, { K: 1 }]].map(([option, scores]) => {
    const [label, ...rest] = String(option).split(" — ");
    return { label, hint: rest.join(" — "), scores: scores as Record<string, number> };
  }),
});
export const DEEP_SPEC_QUESTIONS = [
  Q(1, PRAKRITI, "How would you describe your body frame?", "Thin, light, and difficult to gain weight", "Medium build, muscular, gains and loses weight easily", "Larger, solid frame, gains weight easily"),
  Q(1, PRAKRITI, "What is your natural skin texture when in balance?", "Fine-pored, dry, or thin — can feel papery or delicate", "Warm, combination — prone to redness or flushing when reactive", "Thick, smooth, and oily — pores more visible"),
  Q(1, PRAKRITI, "How would you describe your natural hair?", "Dry, fine, or frizzy — prone to split ends", "Straight, fine-to-medium, with tendency toward thinning or early greying", "Thick, lustrous, and oily — slow to grey"),
  Q(1, PRAKRITI, "How do you naturally respond to stress?", "Anxiety, racing thoughts, trouble sleeping — mind goes into overdrive", "Irritability, intensity, focused frustration — fire turns inward", "Withdrawal, heaviness, resistance to change — slow to react"),
  Q(1, PRAKRITI, "What is your natural energy pattern through the day?", "Variable — bursts of energy followed by fatigue", "Strong, consistent — but burns hot and can crash", "Slow to start, steady once moving, good endurance"),
  Q(1, PRAKRITI, "How would you describe your appetite and digestion at baseline?", "Irregular — sometimes ravenous, sometimes not hungry at all", "Strong and sharp — irritable if meals are missed", "Slow and steady — rarely very hungry, but digestion is reliable"),
  Q(2, VIKRITI, "How does your skin feel right now — today, this week?", "Dry, dull, or tight — possibly flaky around the nose and forehead", "Reactive, inflamed, or sensitive — redness, breakouts, or flushing", "Oily, congested, or puffy — pores feel blocked"),
  Q(2, VIKRITI, "How is your sleep currently?", "Light, interrupted, or anxious — mind active at night", "Intense — vivid dreams, or waking hot in the night", "Heavy and long — hard to wake up, or oversleeping"),
  Q(2, VIKRITI, "How is your digestion right now?", "Irregular — bloating, gas, or constipation", "Acidic — heartburn, loose stools, or sharp hunger", "Slow — heavy feeling after meals, weight gain, sluggishness"),
  Q(2, VIKRITI, "How would you describe your mental state this week?", "Scattered, anxious, or overwhelmed — too many thoughts", "Irritable, critical, or overheating emotionally", "Foggy, slow, unmotivated, or emotionally flat"),
  Q(2, VIKRITI, "What does your skin look like under stress or disruption?", "Dullness, dehydration, fine lines becoming more visible", "Redness, breakouts, inflamed spots, or rosacea flare", "Congestion, blackheads, puffiness, or enlarged pores"),
  Q(2, VIKRITI, "What do you reach for when your skin feels off?", "Oils, rich butters, and deeply nourishing products", "Cooling, calming, anti-inflammatory formulas", "Clarifying, exfoliating, or detoxifying treatments"),
  Q(3, ENVIRONMENT, "What season are you in right now?", "Winter or early spring — cold, dry, or windy", "Late spring or summer — hot, bright, and intense", "Autumn — cool, damp, or transitional"),
  Q(3, ENVIRONMENT, "Where do you live or spend most of your time?", "Dry, arid, or high altitude — desert, mountain, or cold climate", "Hot and sunny — urban heat, dry summers, or tropical sun exposure", "Humid, coastal, or temperate — moisture in the air year-round"),
  Q(3, ENVIRONMENT, "How would you describe your daily lifestyle pace?", "Fast-paced, irregular, lots of travel or movement", "Intense, goal-driven, long focused hours — high performance", "Slow, steady, routine-oriented — comfort-seeking"),
  Q(3, ENVIRONMENT, "What is your skin exposed to on most days?", "Dry, moving air — air-conditioning, heating, wind, screens, or frequent travel", "Sun and heat — outdoor commute, exercise, or strong daylight exposure", "Cool, still, or damp air — long, sedentary hours in one place with little movement"),
  Q(3, ENVIRONMENT, "How consistent is your skincare routine?", "Irregular — varies day to day depending on energy", "Disciplined — you follow a protocol and stick to it", "Minimal — simple, low-effort, and consistent"),
  Q(3, ENVIRONMENT, "What is your relationship to heat and cold?", "Cold- and wind-sensitive — hands and feet often cold, skin dries out in wind", "Heat-sensitive — prefer cool environments, dislike humidity", "Damp-sensitive — feel heavy and sluggish in cold, wet weather; best when warm and dry"),
];

// What the storefront shows for a result: the spec content plus the ritual with each step's product.
export function doshaGuide(key: string) {
  const content = DOSHA_CONTENT[key as DoshaResultKey] || DOSHA_CONTENT.balanced;
  const { products, notes, ...guide } = content;
  return { ...guide, weeklyFrequency: FREQUENCY_LABELS[products.weekly.frequency] || "", notes };
}
export type DoshaGuide = ReturnType<typeof doshaGuide>;
