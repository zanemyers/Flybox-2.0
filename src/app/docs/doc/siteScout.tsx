import * as info from "../docInfo/siteScout"
import { siteScoutForm, newStarterFile } from "@/app/docs/images/siteScout/images"
import DocOverview from "@/components/sections/docOverview";
import DocSection from "@/components/sections/doc";
import ListBlock from "@/components/sections/listBlock";
import CenteredImage from "@/components/images/centered";

/**
 * SiteScoutDoc Component
 *
 * Renders full documentation for the SiteScout tool, including:
 * - Overview
 * - Instructions for using the form
 * - Input/Output file explanations
 * - Additional notes
 */
export default function SiteScoutDoc() {
    return (
        <>
            {/* Page Overview */}
            <DocOverview title="SiteScout" icon="🗺" tocItems={info.tocItems}>
                <p>
                    SiteScout helps keep your <strong>FishTales</strong> starter file up to date. It checks
                    the latest <strong>ShopReel</strong> results and adds any new report sites automatically.
                </p>
            </DocOverview>

            <hr />

            {/* Main instructions section */}
            <DocSection
                title="Using the SiteScout Form"
                overview="Use the SiteScout form to update your FishTales starter file by importing two Excel files."
            >
                {/* Inputs subsection */}
                <DocSection
                    subSection={true}
                    title="Inputs"
                    conclusion="After selecting the files, click **Compare**. You’ll see progress updates as SiteScout runs."
                >
                    <ListBlock items={info.inputListItems} />
                    <CenteredImage img={siteScoutForm} alt="SiteScout Form" />
                </DocSection>

                {/* Output files subsection */}
                <DocSection
                    subSection={true}
                    title="Output Files"
                    overview="After running the comparison, SiteScout creates the following file:"
                >
                    <ListBlock items={info.outputListItems} />
                    <CenteredImage img={newStarterFile} alt="New FishTales starter file" />
                </DocSection>
            </DocSection>

            <hr />

            {/* Additional notes section */}
            <DocSection title="Additional Notes">
                <ListBlock items={info.notesListItems} />
            </DocSection>
        </>
    );
}
