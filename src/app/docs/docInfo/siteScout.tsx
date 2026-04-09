import HashLink from "@/components/links/hash";

/** Table of contents items for the page */
const tocItems = [
    {
        label: "Using the SiteScout Form",
        children: [{ label: "Inputs" }, { label: "Output Files" }],
    },
    { label: "Additional Notes" },
];

/** Items describing the inputs required by the form */
const inputListItems = [
    {
        label: "ShopReel File",
        main: "Import the final results file you got from ShopReel.",
    },
    {
        label: "FishTales Starter File",
        main: "Import your current starter file, or use the [**example file**](/example_files/fishTales_starter_file.xlsx)",
    },
];

/** Items describing the output files generated */
const outputListItems = [
    {
        label: "new_fishTales_starter.xlsx",
        main: "Includes all the original entries plus any new sites found in your ShopReel results.",
        noteLabel: "Note",
        note: (
            <>
                Only new URLs are added; the rest of your file stays the same. For full instructions on
                how to update your starter file, see the <HashLink
                target="update-your-starter-file"
                tab="FishTales"
                // onActivateTab="FishTales" // TODO: Fix tab transition
                >
                Update Your Starter File
            </HashLink> guide.
            </>
        ),
    },
];

/** Additional notes for the user */
const notesListItems = [
    {
        main: "SiteScout works together with **FishTales** and **ShopReel** to keep your data up to date.",
    },
    {
        main: "Future updates may add better ways to detect duplicate entries.",
    },
];

export { tocItems, inputListItems, outputListItems, notesListItems }