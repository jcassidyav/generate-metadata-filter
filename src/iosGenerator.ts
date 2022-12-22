import * as fs from "fs";
import path from "path";
import { ts } from "ts-morph";
import { DeclarationInfo, SymbolInfo } from "./compile";
import { IConfig } from "./config";

export class IOSGenerator {
    constructor(private config: IConfig) {}
    private result = new Array<Rule>();
    generate(scanResult: Map<string, SymbolInfo>) {
        // build
        for (const entry of scanResult.entries()) {
            let left;
            let right;

            console.log(entry[0]);
            const info = entry[1];
            console.log("name", info.name, "kind", info.declaration.kindName);
            if (
                info.declaration.kind === ts.SyntaxKind.ClassDeclaration ||
                info.declaration.kind === ts.SyntaxKind.EnumDeclaration ||
                info.declaration.kind === ts.SyntaxKind.InterfaceDeclaration ||
                (info.declaration.typeClassification?.isIOS && (info.declaration.kind === ts.SyntaxKind.VariableDeclaration || info.declaration.kind === ts.SyntaxKind.FunctionDeclaration))
            ) {
                right = info.name;
                left = this.getModuleFromFile(info.declaration.filePath);
                if (left) {
                    if (info.declaration.ancestors && info.declaration.ancestors.length > 0) {
                        console.log("Has ancestors");
                        const ancestorInfo = this.considerAncestorRules(info.declaration.ancestors);

                        left = ancestorInfo.left;
                        right = ancestorInfo.right.length > 0 ? ancestorInfo.right + "." + right : right;

                        // this.addAncestorRules(info.declaration.ancestors);
                    }
                    this.result.push({ left, right });
                } else {
                    console.log("No Left");
                }
            } else if (info.declaration.kind === ts.SyntaxKind.PropertyDeclaration) {
                // It seems that the params/return types are enough to operate on ( actually my still have a gap here as the return type of the property is not considered.)
            } else if (info.declaration.kind === ts.SyntaxKind.MethodDeclaration) {
                // It seems that the params/return types are enough to operate on
            }
        }

        console.log("************ results *************");
        this.result.forEach((r) => console.log("left", r.left, "right", r.right));
        // add to correct template
        const outputResult = this.populateTemplate();
        const outPath = this.config.output ?? "";
        if (this.config.output) fs.mkdirSync(this.config.output, { recursive: true });
        fs.writeFileSync(path.join(outPath, "ios-native-api-usage.json"), JSON.stringify(outputResult, null, 5));
        // write to location
    }
    getModuleFromFile(filePath: string | undefined): string | undefined {
        if (filePath) {
            console.log("file path:", filePath);

            const fileName = path.basename(filePath);
            console.log("file Name:", fileName);
            const nameComponents = fileName.split("!");
            if (nameComponents[0] === "objc") {
                const fileParts = nameComponents[1].split(".");
                console.log("Module Name:", fileParts[0]);
                return fileParts[0];
            }
        }
        return;
    }

    populateTemplate(): unknown {
        const result = new Set<string>();

        this.result.forEach((r) => {
            result.add(r.left + "*:" + r.right); // * is added because we cannot tell if it is a submodule or not
        });

        if (this.config.mode == "app") {
            const template = new AppTemplate();
            template.whitelist = Array<string>.from(result).sort();
            return template;
        } else if (this.config.mode == "plugin") {
            const template = new PluginTemplate();

            template.uses = Array<string>.from(result).sort();
            return template;
        }
    }
    considerAncestorRules(ancestors: DeclarationInfo[]): Rule {
        const theClasses: string[] = [];
        let thePackage = "";

        for (const ancestor of ancestors) {
            if (ancestor.kindName === "ClassDeclaration") {
                theClasses.push(ancestor.name);
            } else if (ancestor.kindName === "ModuleDeclaration") {
                thePackage = ancestor.fullName;
                break;
            }
        }

        return { left: thePackage, right: theClasses.reverse().join(".") };
    }
    addAncestorRules(ancestors: DeclarationInfo[]) {
        if (ancestors.length > 1) {
            const base = ancestors[0];
            const parent = ancestors[1];
            if (base.kindName === "ClassDeclaration") {
                this.result.push({ left: parent.fullName, right: base.name });
                this.addAncestorRules(ancestors.slice(1));
            }
        }
    }
}

interface Rule {
    left: string;
    right: string;
}

class PluginTemplate {
    public uses: Array<string> = [];
}

class AppTemplate {
    public "whitelist-plugins-usages" = true;
    public whitelist: Array<string> = [];
    public blacklist: Array<string> = [];
}
