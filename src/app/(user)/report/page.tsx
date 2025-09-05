
"use client";

import ReportActivity from '@/components/dashboard/report-activity';
import MyReportHistory from '@/components/profile/my-report-history';


export default function ReportPage() {

    return (
        <div className="space-y-6">
            <ReportActivity />
            <MyReportHistory />
        </div>
    )
}
