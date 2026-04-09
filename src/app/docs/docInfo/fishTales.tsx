import {
    arHome, arReport,
    arReportList,
    gaiApi,
    gaiHome,
    gaiKey,
    gaiLogin,
    gaiTerms,
    newSite, siteList, updatedFile
} from "@/app/docs/images/fishTales/images";


/** Table of Contents */
const tocItems = [
    {
        label: "Using the FishTales Form",
        children: [
            { label: "Basic Inputs" },
            { label: "Advanced Inputs" },
            { label: "Output Files" },
        ],
    },
    { label: "Get Your Gemini API Key" },
    {
        label: "Update Your Starter File",
        children: [{ label: "Advanced Selectors" }],
    },
    { label: "Disclaimers" },
    { label: "Additional Notes" },
];

/** Basic input fields */
const basicInputListItems = [
    {
        label: "Gemini API Key",
        main: "Enter your private API key here. This lets FishTales use the Gemini AI to read and summarize reports.",
        noteLabel: "Note",
        note: "This is required for the tool to work.",
    },
    {
        label: "Max Report Age",
        main: "Choose how old the reports can be. FishTales will ignore anything older than this.",
        noteLabel: "Default",
        note: <><i>100</i>{" "}(<strong>Min:</strong> <i>10</i>)</>,
    },
    {
        label: "Filter by Rivers",
        main: "Turn this on if you only want reports from certain rivers.",
        noteLabel: "Default",
        note: <><i>false</i> (includes all rivers)</>,
    },
    {
        label: "River Names",
        main: "(*Optional*) List the rivers you want, separated by commas.",
    },
    {
        label: "Starter File",
        main: "Upload your current dataset, or use the [**example file**](/example_files/fishTales_starter_file.xlsx) to get started.",
    },
];

/** Advanced input fields */
const advancedInputListItems = [
    {
        label: "Include Site List",
        main: "When enabled, **site_list.txt** will be generated containing all scraped sites. This can help refine or update your starter file.",
        noteLabel: "Default",
        note: "`false`",
    },
    {
        label: "Token Limit",
        main: "Maximum text the model can read at once. Too high can cause errors; too low may miss details.",
        noteLabel: "Default",
        note: "`25` (*Max:* `25`, *Min:* `5`)",
    },
    {
        label: "Crawl Depth",
        main: "How many links the scraper follows to find reports. Higher numbers may find more reports but take longer.",
        noteLabel: "Default",
        note: "`25` (*Max:* `25`, *Min:* `5`)",
    },
    {
        label: "Model",
        main:
            "Pick which Gemini AI model you want to use. Different models may give slightly different results. See " +
            "available models at [ai.google.dev](https://ai.google.dev/models/gemini)",
        noteLabel: "Default",
        note: "`gemini-2.5-flash`",
    },
    {
        label: "Summary Prompt",
        main: "Instructions for the AI on summarizing each report.",
        noteLabel: "Optional",
        note: "Leave default if unsure.",
    },
    {
        label: "Crawl Depth",
        main: "Instructions for combining multiple summaries into one final report.",
        noteLabel: "Optional",
        note: "Leave default if unsure.",
    },
];

/** Output files */
const outputListItems = [
    {
        label: "report_summary.txt",
        main: "Contains all summarized report information. Open this to read a simple summary of everything FishTales found.",
    },
    {
        label: "site_list.txt",
        main:
            "(*optional*) A text file containing all scraped websites. Useful for identifying keywords and filtering out" +
            " junk terms in the URL to refine your starter",
    },
];

/** Gemini API key setup steps */
const geminiListItems = [
    {
        main: "Go to [ai.google.dev](https://ai.google.dev/aistudio) and sign in with your Google account.",
        img: gaiLogin,
        alt: "Login",
    },
    {
        main: "First-time users will see a welcome message; otherwise, click `Get API key`.",
        img: gaiHome,
        alt: "Dashboard",
    },
    {
        main: "Accept the terms and conditions (first-time users only), then click `I accept`.",
        img: gaiTerms,
        alt: "Terms",
    },
    {
        main: "Click `+ Create API key` or select an existing key.",
        img: gaiApi,
        alt: "API Keys",
    },
    {
        main: "Copy your API key and keep it safe.",
        img: gaiKey,
        alt: "API Key",
    },
];

/** Starter file update steps */
const updateFileListItems = [
    {
        main: "Run **SiteScout** to see if your starter file is missing any report sites.",
        img: newSite,
        alt: "New Sites",
    },
    {
        main: "Open each new site in your browser. Look for sections like *Reports*, *Blog*, or *Fishing Updates*.",
        img: arHome,
        alt: "Arricks Page",
    },
    {
        main: "Pay attention to date, keywords, junk words, and click-phrases to determine if a site is actively updated.",
        img: arReportList,
        alt: "Report List",
    },
    {
        main: "Use the browser inspector to find the HTML element containing the report:",
        img: arReport,
        alt: "Report",
        children: [
            {
                main: "Right-click > Inspect (or Inspect Element)",
                children: [
                    {
                        main: "Keyboard shortcuts (Win/Linux: `Ctrl+Shift+I` · Mac: `Cmd+Opt+I` · Both: `F12`)",
                    },
                ],
            },
            {
                main: "Hover over elements or use the **element picker** to locate the report text.",
            },
            {
                main: 'Look for a container element, e.g., `<article>;` or `<div class="post">`.',
            },
        ],
    },
    {
        main: "Add keywords, junk-words, click-phrases, selector, and optionally last report date.",
        img: updatedFile,
        alt: "Updated File",
    },
    {
        main:
            "Run FishTales with the updated starter file and enable **Include Site List** under advanced settings. " +
            "Then, use the generated site list to review and refine your keywords and junk-words for more accurate scraping and summaries.",
        img: siteList,
        alt: "Site List",
    },
];

/** Advanced selector tips */
const advancedSelectorTips = [
    {
        main: "Try simple selectors first. Only use advanced ones if you can’t capture the report otherwise.",
    },
    {
        main: "Test your selector in the browser console to make sure it highlights only the report text.",
    },
    {
        main: "If you get stuck, tools like **GPT** or **Gemini** can help you write or debug a selector.",
    },
    {
        main: "Keep notes in your starter file so you remember why you used a particular selector.",
    },
];

/** Disclaimers */
const disclaimersListItems = [
    {
        label: "Summarization accuracy",
        main: "Summaries may vary depending on AI model.",
    },
    { label: "Blocked pages", main: "Some websites may block access." },
];

/** Additional notes */
const notesListItems = [
    {
        main: "Future updates may support more AI models and filtering options.",
    },
];

export {tocItems, basicInputListItems, advancedInputListItems, outputListItems, geminiListItems, updateFileListItems, advancedSelectorTips, disclaimersListItems, notesListItems}