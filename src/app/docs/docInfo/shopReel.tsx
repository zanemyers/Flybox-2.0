import * as ShopReelImages from "@/app/docs/images/shopReel/images"
import ExternalLink from "@/components/links/external"

/** Table of contents for the page */
const tocItems = [
    {
        label: "Using the ShopReel Form",
        children: [{ label: "Manual Input" }, { label: "File Import" }, { label: "Output Files" }],
    },
    { label: "Get Your SerpAPI Key" },
    { label: "Disclaimers" },
    { label: "Additional Notes" },
];

/** Manual Input tab fields and notes */
const manualInputListItems = [
    {
        label: "SerpAPI Key",
        main: "Enter your private API key to allow ShopReel to access Google Maps data.",
        noteLabel: "Note",
        note: "Required for the tool to work.",
    },
    {
        label: "Search Term",
        main: 'Type of business you want to find (e.g., "Fly Fishing Shops").',
        noteLabel: "Default",
        note: <code>Fly Fishing Shops</code>,
    },
    {
        label: "Location",
        main: "Latitude and longitude for the search. You can also click the map to pick a spot.",
        noteLabel: "Default",
        note: <p>Yellowstone National Park (<strong>Latitude:</strong> <code>44.427963</code>, <strong>Longitude:</strong> <code>-110.588455</code>)</p>,
    },
    {
        label: "Max Results",
        main: "How many results to retrieve. ShopReel fetches in batches of 20.",
        noteLabel: "Default",
        note: <p><code>100</code> (<strong>Max:</strong> <code>120</code>, <strong>Min:</strong> <code>20</code>)</p>,
    },
];

/** File Import tab fields and notes */
const fileImportListItems = [
    {
        label: "simple_shop_details.xlsx",
        main: "Import the simple details from a previous run to reuse shop data.",
        noteLabel: "Note",
        note: "This helps ShopReel run faster by avoiding repeated requests to SerpAPI.",
    },
];

/** Output files depending on search type */
const outputListItems = [
    {
        label: "Manual Input",
        children: [
            {
                label: "simple_shop_details.xlsx",
                main: "Created immediately. Contains basic shop info and can be reused.",
                img: ShopReelImages.simpleDetails,
                alt: "Simple Shop Details",
            },
            {
                label: "shop_details.xlsx",
                main: "Contains detailed info from shop websites (emails, online stores, social links).",
                img: ShopReelImages.details,
                alt: "Shop Details",
            },
        ],
    },
    {
        label: "File Import",
        children: [
            {
                label: "shop_details.xlsx",
                main: <p>Since <strong>simple_shop_details.xlsx</strong> was provided, it will not be downloaded again.</p>,
            },
        ],
    },
];

/** Steps for obtaining a SerpAPI key */
const serpListItems = [
    {
        main: <p>Go to <ExternalLink target="https://serpapi.com/">SerpApi</ExternalLink> and create an account</p>,
        img: ShopReelImages.serpHome,
        alt: "SerpAPI App",
    },
    {
        main: "Verify your email and phone number to set up a free account.",
        img: ShopReelImages.serpSub,
        alt: "SerpAPI Subscription",
    },
    {
        main: <p>Your API key is automatically generated. Copy the section called <code>Your Private API Key</code> to use in ShopReel.</p>,
        img: ShopReelImages.serpDashboard,
        alt: "Your Private API Key",
    },
];

/** Disclaimers about tool limitations */
const disclaimersListItems = [
    {
        label: "Email scraping",
        main: "Some emails may be missing or outdated. Results are not guaranteed to be 100% accurate.",
    },
    {
        label: "Blocked pages",
        main: "Some websites may prevent ShopReel from accessing them. Fallback data will be used in these cases.",
    },
];

/** Additional notes for users */
const notesListItems = [
    {
        main: "Future updates may add support for other APIs and extra filtering options to refine searches.",
    },
];

export {tocItems, manualInputListItems, fileImportListItems, outputListItems, serpListItems, disclaimersListItems, notesListItems}