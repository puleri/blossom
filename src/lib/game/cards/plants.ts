import type { PlantCard } from "@/lib/game/types";

export const PLANT_CARDS: PlantCard[] = [
  {
    id: "strawberry-bush",
    name: "Strawberry Bush",
    points: 3,
  },
  {
    id: "clover-patch",
    name: "Clover Patch",
    points: 1,
  },
  {
    id: "aloe-vera",
    name: "Aloe Vera",
    points: 4,
  },
  {
    id: "barrel-cactus",
    name: "Barrel Cactus",
    points: 7,
  },
  {
    id: "lavender",
    name: "Lavender",
    points: 4,
  },
  {
    id: "tomato-vine",
    name: "Tomato Vine",
    points: 5,
  },
  {
    id: "basil",
    name: "Basil",
    points: 3,
  },
  {
    id: "orchid",
    name: "Orchid",
    points: 10,
  },
  {
    id: "bird-of-paradise",
    name: "Bird-of-Paradise",
    points: 9,
  },
  {
    id: "venus-flytrap",
    name: "Venus Flytrap",
    points: 6,
  },
  {
    id: "pitcher-plant",
    name: "Pitcher Plant",
    points: 4,
  },
  {
    id: "sundew-cluster",
    name: "Sundew Cluster",
    points: 3,
  },
  {
    id: "cobra-lily",
    name: "Cobra Lily",
    points: 8,
  },
  {
    id: "bladderwort",
    name: "Bladderwort",
    points: 5,
  },
  {
    id: "thornmaw-bramble",
    name: "Thornmaw Bramble",
    points: 6,
  },
  {
    id: "sporefang-vine",
    name: "Sporefang Vine",
    points: 6,
  },
  {
    id: "gloomtrap-shrub",
    name: "Gloomtrap Shrub",
    points: 9,
  },
  {
    id: "mawroot-bulb",
    name: "Mawroot Bulb",
    points: 5,
  },
  {
    id: "carrion-bloom",
    name: "Carrion Bloom",
    points: 8,
  },
  {
    id: "razorleaf-net",
    name: "Razorleaf Net",
    points: 6,
  },
  {
    id: "apex-devourer",
    name: "Apex Devourer",
    points: 12,
  },
  {
    id: "mint",
    name: "Mint",
    points: 2,
  },
  {
    id: "sunpetal-daisy",
    name: "Sunpetal Daisy",
    points: 3,
  },
  {
    id: "golden-marigold",
    name: "Golden Marigold",
    points: 6,
  },
  {
    id: "night-lantern-flower",
    name: "Night Lantern Flower",
    points: 5,
  },
  {
    id: "bloomkeeper-ivy",
    name: "Bloomkeeper Ivy",
    points: 4,
  },
  {
    id: "crowned-peony",
    name: "Crowned Peony",
    points: 9,
  },
  {
    id: "petal-archivist",
    name: "Petal Archivist",
    points: 3,
  },
  {
    id: "nectar-fountain",
    name: "Nectar Fountain",
    points: 7,
  },
  {
    id: "sun-choir-shrub",
    name: "Sun Choir Shrub",
    points: 6,
  },
  {
    id: "dewglass-orchid",
    name: "Dewglass Orchid",
    points: 10,
  },
  {
    id: "petal-alchemist",
    name: "Petal Alchemist",
    points: 4,
  },
  {
    id: "sunroot-conductor",
    name: "Sunroot Conductor",
    points: 8,
  },
  {
    id: "verdant-festival-tree",
    name: "Verdant Festival Tree",
    points: 12,
  },
  {
    id: "sandspire-cactus",
    name: "Sandspire Cactus",
    points: 4,
  },
  {
    id: "dustbloom-succulent",
    name: "Dustbloom Succulent",
    points: 6,
  },
  {
    id: "thornbark-shrub",
    name: "Thornbark Shrub",
    points: 5,
  },
  {
    id: "parched-root-network",
    name: "Parched Root Network",
    points: 7,
  },
  {
    id: "sunscorch-agave",
    name: "Sunscorch Agave",
    points: 8,
  },
  {
    id: "wither-sage",
    name: "Wither Sage",
    points: 4,
  },
  {
    id: "desert-mat-creeper",
    name: "Desert Mat Creeper",
    points: 2,
  },
  {
    id: "scorchvine",
    name: "Scorchvine",
    points: 6,
  },
  {
    id: "mirage-bloom",
    name: "Mirage Bloom",
    points: 5,
  },
  {
    id: "ironwood-sapling",
    name: "Ironwood Sapling",
    points: 9,
  },
  {
    id: "ashflower-bush",
    name: "Ashflower Bush",
    points: 6,
  },
  {
    id: "dominion-baobab",
    name: "Dominion Baobab",
    points: 12,
  },
  {
    id: "dustcap-mycelium",
    name: "Dustcap Mycelium",
    points: 4,
    biome: "rainforest",
    level: 2,
    sunCapacity: 2,
    engineSummary: "Root — You may spend 1 compost to draw 2 plant cards.",
    flavorText: "What dies above feeds what spreads below."
  },
  {
    id: "gravecap-recycler",
    name: "Gravecap Recycler",
    points: 4,
    biome: "rainforest",
    level: 2,
    sunCapacity: 3,
    engineSummary: "Root — You may tuck 1 card from your hand beneath this plant to gain 1 compost.",
    flavorText: "Nothing is wasted beneath the soil."
  },
  {
    id: "veilspore-archivist",
    name: "Veilspore Archivist",
    points: 5,
    biome: "plains",
    level: 3,
    sunCapacity: 4,
    engineSummary: "Pollinate — Draw 2 cards, then tuck 1 card from your hand beneath this plant.",
    flavorText: "It remembers what the forest forgets."
  },
  {
    id: "dune-cache-oak",
    name: "Dune Cache Oak",
    points: 5,
    biome: "rainforest",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Understory-only seed-storer; on Root activation gain **1 seed or 1 compost**."
  },
  {
    id: "saltflat-mirrorleaf",
    name: "Saltflat Mirrorleaf",
    points: 7,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Expensive point bloom; bonus if another plant has a basin nest-equivalent trait."
  },
  {
    id: "fen-reed-sentinel",
    name: "Fen Reed Sentinel",
    points: 5,
    biome: "desert",
    sunCost: 2,
    sunCapacity: 2,
    engineSummary: "High raw points, tiny sunlight cap, minimal engine value."
  },
  {
    id: "marsh-reed-collector",
    name: "Marsh Reed Collector",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 5,
    engineSummary: "Pollinate draw+compost engine with large sunlight storage."
  },
  {
    id: "ashgrove-forager",
    name: "Ashgrove Forager",
    points: 3,
    biome: ["desert", "plains", "rainforest"],
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Tri-biome converter; spend sunlight to gain 2 mixed resources (weaker Raven line)."
  },
  {
    id: "sandgrain-finchbloom",
    name: "Sandgrain Finchbloom",
    points: 3,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Refund-style seed plant; weak if paid full cost."
  },
  {
    id: "dust-talon-succulent",
    name: "Dust Talon Succulent",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Predator-tagged point plant; unreliable hunt effect."
  },
  {
    id: "tideline-shellroot",
    name: "Tideline Shellroot",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Selective tray-draw support that can feed opponents."
  },
  {
    id: "embertail-nectar-sprig",
    name: "Embertail Nectar Sprig",
    points: 5,
    biome: "rainforest",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Understory food accelerator without table sharing."
  },
  {
    id: "thicket-redberry",
    name: "Thicket Redberry",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 5,
    engineSummary: "Non-meadow compost/draw line; decent emergency sunlight bank."
  },
  {
    id: "shoal-net-lotus",
    name: "Shoal Net Lotus",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Fish-linked compost scorer that spikes with direct fish support."
  },
  {
    id: "hollow-fern-monument",
    name: "Hollow Fern Monument",
    points: 8,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Pure efficient point bomb."
  },
  {
    id: "bog-spearvine",
    name: "Bog Spearvine",
    points: 3,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Mediocre frame, predator-synergy point bomb when supported."
  },
  {
    id: "scarlet-nectar-bloom",
    name: "Scarlet Nectar Bloom",
    points: 5,
    biome: ["desert", "plains", "rainforest"],
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Tri-biome flexible accelerator; gain any 1 root resource."
  },
  {
    id: "drywind-cupvine",
    name: "Drywind Cupvine",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Late-game burst points based on matching nest-structure plants."
  },
  {
    id: "starpool-driftbloom",
    name: "Starpool Driftbloom",
    points: 8,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "High-variance mega point bomb tied to lucky reveals."
  },
  {
    id: "prairie-threadgrass",
    name: "Prairie Threadgrass",
    points: 5,
    biome: "desert",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Useful lay-anywhere sunlight power but overcosted."
  },
  {
    id: "apex-sun-raptor-bloom",
    name: "Apex Sun Raptor Bloom",
    points: 7,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Expensive predator bomb with occasional fish refund."
  },
  {
    id: "amberfruit-bannerflower",
    name: "Amberfruit Bannerflower",
    points: 8,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Point bomb with occasional fruit smoothing."
  },
  {
    id: "loftshade-owlroot",
    name: "Loftshade Owlroot",
    points: 3,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Solid body, weak power; bonus-card dependent bomb."
  },
  {
    id: "eaveswift-petal",
    name: "Eaveswift Petal",
    points: 4,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Cheap Pollinate compost/draw micro-engine."
  },
  {
    id: "stripebark-nightbloom",
    name: "Stripebark Nightbloom",
    points: 3,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Weak baseline, rescued by predator bonus tags."
  },
  {
    id: "coldpool-mirrorreed",
    name: "Coldpool Mirrorreed",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Overpriced mid-point body needing nest support partner."
  },
  {
    id: "bellvine-archivist",
    name: "Bellvine Archivist",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 4,
    engineSummary: "Classic bonus-card seeker with star-structure flexibility."
  },
  {
    id: "riverbelt-spearleaf",
    name: "Riverbelt Spearleaf",
    points: 5,
    biome: "desert",
    sunCost: 2,
    sunCapacity: 5,
    engineSummary: "Good sunlight bank; minor pink fish trickle."
  },
  {
    id: "brushline-migrant-bloom",
    name: "Brushline Migrant Bloom",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Overpriced migrator, generally inefficient."
  },
  {
    id: "nightblade-surfaceleaf",
    name: "Nightblade Surfaceleaf",
    points: 3,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Predator-tagged point bomb with weak action power."
  },
  {
    id: "sootwing-marsh-petal",
    name: "Sootwing Marsh Petal",
    points: 4,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 4,
    engineSummary: "Cheap cycle/look effect with decent star capacity."
  },
  {
    id: "carrion-draft-root",
    name: "Carrion Draft Root",
    points: 2,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Zero-cost reactive scavenger; only good in predator-heavy tables."
  },
  {
    id: "emberwhistle-basin-reed",
    name: "Emberwhistle Basin Reed",
    points: 5,
    biome: "desert",
    sunCost: 2,
    sunCapacity: 5,
    engineSummary: "Strong sunlight bank that scales with seed support."
  },
  {
    id: "obsidian-trinketvine",
    name: "Obsidian Trinketvine",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Better scavenger profile, wild cost, utility tags."
  },
  {
    id: "onyx-nectar-bloom",
    name: "Onyx Nectar Bloom",
    points: 3,
    biome: ["desert", "plains", "rainforest"],
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Tri-biome fixer; weaker hummingbird payoff."
  },
  {
    id: "crowned-mire-harvester",
    name: "Crowned Mire Harvester",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Premium Crow-line converter, strong bomb profile."
  },
  {
    id: "saltmarsh-stiltreed",
    name: "Saltmarsh Stiltreed",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Outclassed draw piece; only niche bonus-tag value."
  },
  {
    id: "sapphire-prairie-migrant",
    name: "Sapphire Prairie Migrant",
    points: 3,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Overpriced migrator with weak return."
  },
  {
    id: "azure-cachebloom",
    name: "Azure Cachebloom",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Conditional feeder-dependent gain-or-compost choice."
  },
  {
    id: "mistthread-gnatflower",
    name: "Mistthread Gnatflower",
    points: 4,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Cheap early fixer; efficient tempo stabilizer."
  },
  {
    id: "cerulean-flashbloom",
    name: "Cerulean Flashbloom",
    points: 8,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Undercosted high-point burst plant."
  },
  {
    id: "meadow-chimegrass",
    name: "Meadow Chimegrass",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Nest-setup dependent late-game point burst."
  },
  {
    id: "brinefront-planner-reed",
    name: "Brinefront Planner Reed",
    points: 3,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Weak frame, but strong timing-based tray filtering."
  },
  {
    id: "charmeadow-tuckgrass",
    name: "Charmeadow Tuckgrass",
    points: 5,
    biome: "desert",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Grasslands-locked compost/lay archetype."
  },
  {
    id: "broadsun-talonleaf",
    name: "Broadsun Talonleaf",
    points: 3,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Cheap predator-tagged body with weak hunt power."
  },
  {
    id: "bronze-broodvine",
    name: "Bronze Broodvine",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Great with early cup-structure accelerators."
  },
  {
    id: "siltbeak-basin-lotus",
    name: "Siltbeak Basin Lotus",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Fish-refund illusion card; low standalone quality."
  },
  {
    id: "rustcap-broodvine",
    name: "Rustcap Broodvine",
    points: 5,
    biome: "desert",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Low-cost sunlight parasitic support, highly efficient."
  },
  {
    id: "burrow-halo-cactus",
    name: "Burrow Halo Cactus",
    points: 3,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 4,
    engineSummary: "Good points+capacity, weak power, predator bonus friendly."
  },
  {
    id: "brushtail-latticevine",
    name: "Brushtail Latticevine",
    points: 5,
    biome: ["desert", "plains", "rainforest"],
    sunCost: 2,
    sunCapacity: 4,
    engineSummary: "Tri-biome compost/lay with large star sunlight cap."
  },
  {
    id: "condorshade-scavenger-bloom",
    name: "Condorshade Scavenger Bloom",
    points: 2,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Zero-cost bonus hunter with very poor base stats."
  },
  {
    id: "chaparral-quillgrass",
    name: "Chaparral Quillgrass",
    points: 5,
    biome: "rainforest",
    sunCost: 2,
    sunCapacity: 4,
    engineSummary: "Classic forest-to-sunlight layer with solid capacity."
  },
  {
    id: "northwind-seedpacker",
    name: "Northwind Seedpacker",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Discard 1 seed to compost 2 cards, support-dependent scorer."
  },
  {
    id: "canvas-reed-drifter",
    name: "Canvas Reed Drifter",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 5,
    engineSummary: "Flexible early Pollinate acceleration with large sunlight bank."
  },
  {
    id: "pinechip-cachebud",
    name: "Pinechip Cachebud",
    points: 4,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Cheap caching line that must be played early."
  },
  {
    id: "hearthwren-cardbloom",
    name: "Hearthwren Cardbloom",
    points: 4,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Excellent cheap early draw acceleration and egg-bank analog."
  },
  {
    id: "cassin-archive-petal",
    name: "Cassin Archive Petal",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Reliable bonus-card archetype piece."
  },
  {
    id: "cassin-sunspike-grass",
    name: "Cassin Sunspike Grass",
    points: 5,
    biome: "desert",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Overpriced grassland sunlight spreader."
  },
  {
    id: "cedar-gleam-berryvine",
    name: "Cedar Gleam Berryvine",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Strong if supported despite no Pollinate placement."
  },
  {
    id: "cerulean-chronicle-bloom",
    name: "Cerulean Chronicle Bloom",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Pure bonus-card value plant."
  },
  {
    id: "chestnut-ledgergrass",
    name: "Chestnut Ledgergrass",
    points: 8,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "High-cost/high-point bonus archetype variant."
  },
  {
    id: "chihuahuan-ash-raven-vine",
    name: "Chihuahuan Ash-Raven Vine",
    points: 9,
    biome: "desert",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Top-tier sunlight-to-resource converter; metagame-defining."
  },
  {
    id: "chimney-spiralpetal",
    name: "Chimney Spiralpetal",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 4,
    engineSummary: "Migrator with broad goal tags but low impact capacity."
  },
  {
    id: "chipping-sunthread",
    name: "Chipping Sunthread",
    points: 9,
    biome: "rainforest",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Elite forest-side sunlight spammer."
  },
  {
    id: "clarks-basin-glideroot",
    name: "Clark’s Basin Glideroot",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Extreme points-per-cost efficiency with neutral draw exchange."
  },
  {
    id: "clarks-vaultcone",
    name: "Clark’s Vaultcone",
    points: 8,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Conditional but flexible point bomb."
  },
  {
    id: "common-gritgrackle-vine",
    name: "Common Gritgrackle Vine",
    points: 5,
    biome: ["desert", "plains", "rainforest"],
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Tri-biome compost/lay engine, tag-scaling scorer."
  },
  {
    id: "common-deepcall-reed",
    name: "Common Deepcall Reed",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Conditional converter, good with omnivore-style bonuses."
  },
  {
    id: "common-stream-mergroot",
    name: "Common Stream Mergroot",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Inconsistent hunt effect on good point shell."
  },
  {
    id: "common-dusk-migrant-bloom",
    name: "Common Dusk Migrant Bloom",
    points: 3,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Mediocre migrator despite bonus-tag help."
  },
  {
    id: "common-root-raven-vine",
    name: "Common Root-Raven Vine",
    points: 9,
    biome: "desert",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Premier sunlight-to-resource engine, especially in Desert lane."
  },
  {
    id: "common-goldthroat-reed",
    name: "Common Goldthroat Reed",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "One of the best early high-volume draw engines."
  },
  {
    id: "coopers-talon-thornbloom",
    name: "Cooper’s Talon Thornbloom",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Consistent predator line with strong bonus scaling."
  },
  {
    id: "duskeye-echoreed",
    name: "Duskeye Echoreed",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Mini repeat engine constrained by no Pollinate access."
  },
  {
    id: "prairie-cuttergrass",
    name: "Prairie Cuttergrass",
    points: 5,
    biome: "desert",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Overpriced grassland-only compost/lay piece."
  },
  {
    id: "twincrest-tide-cormroot",
    name: "Twincrest Tide Cormroot",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Fish-fed discard-to-double-compost scorer."
  },
  {
    id: "downy-graftpecker-tree",
    name: "Downy Graftpecker Tree",
    points: 4,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Cheap “play another plant” setup card."
  },
  {
    id: "eastern-skyberry-shrub",
    name: "Eastern Skyberry Shrub",
    points: 5,
    biome: "desert",
    sunCost: 2,
    sunCapacity: 4,
    engineSummary: "Strong “play another plant” with big sunlight capacity."
  },
  {
    id: "eastern-crownking-bloom",
    name: "Eastern Crownking Bloom",
    points: 3,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Low-impact pink trigger; weak overall profile."
  },
  {
    id: "eastern-field-phoebloom",
    name: "Eastern Field Phoebloom",
    points: 5,
    biome: ["desert", "plains", "rainforest"],
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Tri-biome early resource accelerator that shares insects."
  },
  {
    id: "eastern-screech-thornowl",
    name: "Eastern Screech Thornowl",
    points: 8,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Efficient predator-tag point bomb, low consistency power."
  },
  {
    id: "ferric-dune-hawkthorn",
    name: "Ferric Dune Hawkthorn",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Predator-tag bomb with low consistency hunt."
  },
  {
    id: "brackish-fishcrow-vine",
    name: "Brackish Fishcrow Vine",
    points: 5,
    biome: "desert",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Half-Raven converter; decent Desert resource support."
  },
  {
    id: "forsters-marsh-ternpetal",
    name: "Forster’s Marsh Ternpetal",
    points: 4,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Cheap look-and-cycle card that breaks even on draw."
  },
  {
    id: "franklins-scrapgull-bloom",
    name: "Franklin’s Scrapgull Bloom",
    points: 9,
    biome: "desert",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Elite sunlight-to-cards converter central to egg-spam analogs."
  },
  {
    id: "gilded-apex-eaglethorn",
    name: "Gilded Apex Eaglethorn",
    points: 7,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Expensive predator bomb with top-end conversion consistency."
  },
  {
    id: "hoppergrass-sunlayer",
    name: "Hoppergrass Sunlayer",
    points: 3,
    biome: "desert",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Weak base saved by lay-on-any-plant sunlight action."
  },
  {
    id: "gray-echo-catvine",
    name: "Gray Echo Catvine",
    points: 7,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Expensive repeat card that doubles best engine activations."
  },
  {
    id: "great-azure-heronroot",
    name: "Great Azure Heronroot",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Beefy “play another plant” archetype body."
  },
  {
    id: "great-crest-flyvine",
    name: "Great Crest Flyvine",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Conditional feeder accelerator with solid midpoint stats."
  },
  {
    id: "great-egret-monument-reed",
    name: "Great Egret Monument Reed",
    points: 8,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Premium high-point “play another plant” finisher."
  },
  {
    id: "great-hornthorn-owlbloom",
    name: "Great Hornthorn Owlbloom",
    points: 7,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Expensive predator bomb with high consistency ceiling."
  },
  {
    id: "greater-prairie-ledgergrass",
    name: "Greater Prairie Ledgergrass",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 4,
    engineSummary: "Heavy bonus-card archetype with bigger capacity."
  },
  {
    id: "greater-roadthorn-runnervine",
    name: "Greater Roadthorn Runnervine",
    points: 7,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Expensive predator bomb with low consistency."
  },
  {
    id: "green-filter-heronleaf",
    name: "Green Filter Heronleaf",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Flexible food-filtering utility; strong with nectar systems."
  },
  {
    id: "hermit-shade-thrushbloom",
    name: "Hermit Shade Thrushbloom",
    points: 8,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Expensive point bomb with situational majority/minority pink power."
  },
  {
    id: "hooded-mire-repeater",
    name: "Hooded Mire Repeater",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Wetlands-only predator repeater with strong expansion upside."
  },
  {
    id: "hooded-goldwarbler-bloom",
    name: "Hooded Goldwarbler Bloom",
    points: 7,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Efficient 7-point, 2-cost point-heavy body."
  },
  {
    id: "horned-bluff-larkgrass",
    name: "Horned Bluff Larkgrass",
    points: 5,
    biome: "plains",
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Conditional opponent-driven pink tuck from hand."
  },
  {
    id: "homestead-finchvine",
    name: "Homestead Finchvine",
    points: 5,
    biome: ["desert", "plains", "rainforest"],
    sunCost: 2,
    sunCapacity: 5,
    engineSummary: "Tri-biome compost/draw with huge sunlight bank."
  },
  {
    id: "homestead-wrenwood",
    name: "Homestead Wrenwood",
    points: 5,
    biome: ["plains", "rainforest"],
    sunCost: 2,
    sunCapacity: 3,
    engineSummary: "Dual-biome “play another plant” with strong sunlight storage."
  },
];

export const PLANT_CARD_IDS = PLANT_CARDS.map((card) => card.id);
