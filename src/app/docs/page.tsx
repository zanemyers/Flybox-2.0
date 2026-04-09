'use client'

import Tab from "@/components/inputs/tab"
import ShopReelDoc from "./doc/shopReel";
import SiteScoutDoc from "@/app/docs/doc/siteScout";
import FishTalesDoc from "@/app/docs/doc/fishTales";

import { useSearchParams } from "next/navigation";

export default function Docs() {
    const searchParams = useSearchParams();
    const activeTab = searchParams.get("tab") ?? "ShopReel";

    return (
        <div className="w-3/4 mx-auto my-8 py-8 rounded-4xl">
            <div className="tabs tabs-lift tabs-md lg:tabs-lg">
                <Tab label="ShopReel" defaultChecked={activeTab === "ShopReel"}>
                    <ShopReelDoc/>
                </Tab>

                <Tab label="FishTales" defaultChecked={activeTab === "FishTales"}>
                    <FishTalesDoc/>
                </Tab>

                <Tab label="SiteScout" defaultChecked={activeTab === "SiteScout"}>
                    <SiteScoutDoc/>
                </Tab>
            </div>
        </div>
    )
}

