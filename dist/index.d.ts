#!/usr/bin/env node
interface Finding {
    severity: "high" | "medium" | "low";
    type: string;
    file: string;
    description: string;
    line?: number;
}
export declare class ProjectGuardian {
    scan(targetPath: string): Promise<Finding[]>;
    private scanFile;
    private checkSensitiveFile;
}
export {};
