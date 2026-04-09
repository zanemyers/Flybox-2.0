import * as info from "../docInfo/shopReel"
import {manualForm, fileImport} from "@/app/docs/images/shopReel/images"
import DocOverview from "@/components/sections/docOverview";
import DocSection from "@/components/sections/doc";
import ListBlock from "@/components/sections/listBlock";
import CenteredImage from "@/components/images/centered"

export default function ShopReelDoc() {
    return (
        <>
            {/* Page Overview */}
            <DocOverview title="ShopReel" icon="🎣" tocItems={info.tocItems}>
                <p>
                    ShopReel gathers business information from <strong>Google Maps</strong> using <strong>SerpAPI</strong> and
                    from each shop’s website, then puts everything into an easy-to-read Excel file.
                </p>
            </DocOverview>

            <hr />

            {/* Using the ShopReel form section */}
            <DocSection
                title="Using the ShopReel Form"
                overview="The ShopReel form lets you run searches in two ways: by entering your search settings manually, or by uploading an Excel file to reuse data from a previous search."
            >
                {/* Manual Input subsection */}
                <DocSection
                    subSection={true}
                    title="Manual Input"
                    overview="Use this tab to enter your own search settings for a custom ShopReel run. Default values are provided, but you can change them."
                    conclusion={<p>After filling in the fields, click <strong>Search</strong>. Progress updates will appear on the page.</p>}
                >
                    <ListBlock items={info.manualInputListItems} />
                    <CenteredImage img={manualForm} alt="ShopReel Manual Input Form" />
                </DocSection>

                {/* File Import subsection */}
                <DocSection
                    subSection={true}
                    title="File Import"
                    conclusion={<p>Once you select the file, click <strong>Search</strong>. Progress updates will appear as ShopReel runs.</p>}
                >
                    <ListBlock items={info.fileImportListItems} />
                    <CenteredImage img={fileImport} alt="ShopReel File Import Form" />
                </DocSection>

                {/* Output Files subsection */}
                <DocSection
                    subSection={true}
                    title="Output Files"
                    overview="After running a search, ShopReel creates Excel files with shop data. The files returned depend on the type of search:"
                >
                    <ListBlock items={info.outputListItems} />
                </DocSection>
            </DocSection>

            <hr />

            {/* SerpAPI Key instructions */}
            <DocSection title="Get Your SerpAPI Key">
                <ListBlock items={info.serpListItems} ordered={true} />
            </DocSection>

            <hr />

            {/* Disclaimers section */}
            <DocSection title="Disclaimers">
                <ListBlock items={info.disclaimersListItems} />
            </DocSection>

            <hr />

            {/* Additional Notes section */}
            <DocSection title="Additional Notes">
                <ListBlock items={info.notesListItems} />
            </DocSection>
        </>
    );
}