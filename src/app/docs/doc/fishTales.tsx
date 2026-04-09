import * as info from "../docInfo/fishTales"
import { basicForm, advancedForm } from "@/app/docs/images/fishTales/images"
import DocOverview from "@/components/sections/docOverview";
import DocSection from "@/components/sections/doc";
import ListBlock from "@/components/sections/listBlock";
import CenteredImage from "@/components/images/centered";

/**
 * FishTalesDoc Component
 *
 * Full documentation page for FishTales tool.
 * Includes:
 * - Overview
 * - Form usage (Basic & Advanced Inputs)
 * - Output files explanation
 * - Gemini API key setup
 * - Updating starter file
 * - Advanced selectors
 * - Disclaimers
 * - Additional notes
 */
export default function FishTalesDoc() {
    return (
        <>
            {/* Overview */}
            <DocOverview title="FishTales" icon="🐟" tocItems={info.tocItems}>
                <p>
                    FishTales gathers fly-fishing reports from different websites and creates easy-to-read
                    summaries using <strong>Google’s Gemini API</strong>.
                </p>
            </DocOverview>

            <hr />

            {/* Using the form */}
            <DocSection
                title="Using the FishTales Form"
                overview="FishTales lets you set up how reports are collected and summarized.
        Default settings are provided to make it easy, but you can change them
        if you want."
            >
                <DocSection subSection={true} title="Basic Inputs">
                    <ListBlock items={info.basicInputListItems} />
                    <CenteredImage img={basicForm} alt="Basic Input Form" />
                </DocSection>

                <DocSection
                    subSection={true}
                    title="Advanced Inputs"
                    overview="Optional settings for control over scraping and summarization."
                    conclusion={<p>Click <strong>Search & Summarize</strong> to run. Progress updates will appear as FishTales works.</p>}
                >
                    <ListBlock items={info.advancedInputListItems} />
                    <CenteredImage img={advancedForm} alt="Advanced Input Form" />
                </DocSection>

                <DocSection
                    subSection={true}
                    title="Output Files"
                    overview="FishTales generates these files after running:"
                >
                    <ListBlock items={info.outputListItems} />
                </DocSection>
            </DocSection>

            <hr />

            {/* Gemini API Key */}
            <DocSection title="Get Your Gemini API Key">
                <ListBlock items={info.geminiListItems} ordered={true} />
            </DocSection>

            <hr />

            {/* Updating Starter File */}
            <DocSection
                title="Update Your Starter File"
                overview="Keep the starter file accurate to enable proper scraping and summarization."
            >
                <ListBlock items={info.updateFileListItems} ordered={true} />
            </DocSection>

            <DocSection
                subSection={true}
                title="Advanced Selectors"
                overview="Most of the time, yo=u can use a simple selector like `<article>` or `div.post` to capture the report content.
          These are easier to maintain and less likely to break if the website changes."
                conclusion="Used carefully, advanced selectors let FishTales capture reports even from tricky websites."
            >
                <p className="mt-3">
                    Sometimes a site doesn’t use clear containers, and you’ll need a more{" "}
                    <strong>advanced selector</strong> to target the report. For example:
                </p>
                <pre>
          <code>div.entry-content:has(p:text-matches("Fishing Report", "i"))</code>
        </pre>
                <p>
                    This means: “look for a <code>div</code> with the class <code>entry-content</code> that
                    contains a paragraph mentioning ‘Fishing Report’ (ignoring upper/lower case).”
                </p>
                <p>
                    Advanced selectors can feel complicated, but don’t worry — you don’t need to start from
                    scratch. Check the{" "}
                    <a href="/example_files/fishTales_starter_file.xlsx" download>
                        example starter file
                    </a>{" "}
                    included with FishTales for working examples you can build on.
                </p>
                <>Tips for advanced selectors:</>
                <ListBlock items={info.advancedSelectorTips} />
            </DocSection>

            <hr />

            {/* Disclaimers */}
            <DocSection title="Disclaimers">
                <ListBlock items={info.disclaimersListItems} />
            </DocSection>

            <hr />

            {/* Additional Notes */}
            <DocSection title="Additional Notes">
                <ListBlock items={info.notesListItems} />
            </DocSection>
        </>
    );
}
