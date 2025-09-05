
"use client";

import ReportActivity from '@/components/dashboard/report-activity';
import ReportHistory from '@/components/profile/report-history';

export default function ReportPage() {

    return (
        <div className="space-y-6">
            <ReportActivity />
            <ReportHistory />
        </div>
    )
}

