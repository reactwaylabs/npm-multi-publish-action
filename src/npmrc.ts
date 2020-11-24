import * as fs from "fs-extra";

export interface NpmCredentials {
    registry: string;
    token: string;
}

export async function createNpmrc(filePath: string, credentials: NpmCredentials): Promise<void> {
    const content = `//${credentials.registry}/:_authToken=${credentials.token}`;

    await fs.writeFile(filePath, content, "utf8");
}
