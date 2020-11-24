import * as path from "path";
import * as fs from "fs-extra";
import * as core from "@actions/core";
import * as io from "@actions/io";
import * as exec from "@actions/exec";
import * as glob from "@actions/glob";
import * as semver from "semver";
import semverRegex from "semver-regex";

import { createNpmrc, NpmCredentials } from "./npmrc";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const NPMRC_LOCATION = path.join(process.env.HOME!, ".npmrc");

core.debug(`.npmrc location: ${NPMRC_LOCATION}`);

async function run(): Promise<void> {
    try {
        const npmCliPath = await io.which("npm", true);

        const absolutePath = path.resolve(core.getInput("path"));
        core.debug(`Resolved path to search for tarballs: ${absolutePath}.`);

        const credentials: NpmCredentials = {
            registry: core.getInput("registry", { required: true }),
            token: core.getInput("token", { required: true })
        };

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await createNpmrc(NPMRC_LOCATION, credentials);

        const access = core.getInput("access");
        const dryRun = core.getInput("dryRun") === "true";
        const useTags = core.getInput("useTags") === "true";

        const globber = await glob.create(path.join(absolutePath, "**.tgz"));
        const files = await globber.glob();
        core.debug(`Found files:\n${files.join("\n")}`);

        const failedFiles: string[] = [];
        for (const filePath of files) {
            try {
                const cliArguments: string[] = [];

                if (useTags) {
                    const semverRegexArray: RegExpExecArray | null = semverRegex().exec(filePath);
                    if (semverRegexArray != null) {
                        const fixedSemver = semverRegexArray[0].replace(".tgz", "");
                        const preReleases = semver.prerelease(fixedSemver);

                        if (preReleases != null && preReleases.length > 0) {
                            cliArguments.push("--tag", preReleases[0]);
                        }
                    }
                }

                if (access !== "") {
                    cliArguments.push("--access", access);
                }

                if (dryRun) {
                    cliArguments.push("--dry-run");
                }

                await exec.exec(`"${npmCliPath}"`, ["publish", filePath, ...cliArguments], { cwd: absolutePath });
            } catch (error) {
                failedFiles.push(filePath);
                core.error(error);
            }
        }

        if (failedFiles.length === files.length) {
            throw new Error(`All tarballs failed to publish: ${JSON.stringify(failedFiles)}.`);
        }
    } catch (error) {
        core.setFailed(error.message);
    } finally {
        await fs.unlink(NPMRC_LOCATION);
    }
}

void run();
