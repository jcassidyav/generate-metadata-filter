import path from "path";
import { match } from "minimatch";
import { Project, ts, Node, TypeNode, MethodDeclaration, Symbol, ModuleDeclaration } from "ts-morph";
import { IConfig } from "./config";

export class Scanner {
    constructor(private config: IConfig) {}
    private identified = new Map<string, SymbolInfo>();
    private log = false;

    private logDetails(node: Node<ts.Node> | TypeNode<ts.TypeNode> | undefined, symbol: Symbol | undefined, declaration: DeclarationInfo, parent?: DeclarationInfo) {
        const checkParent = symbol?.getDeclarations()[0]?.getParent()?.getKindName();

        const filePath = symbol?.getDeclarations()[0].getSourceFile().getFilePath();
        const kindName = symbol?.getDeclarations()[0].getKindName();
        const symbolName = symbol?.getFullyQualifiedName();

        if (this.log) {
            console.log("Parent is:", checkParent);

            console.log("Symbol declared in:", filePath);
            console.log("Symbol: symbol name", symbolName);
            console.log("Symbol Type", symbol?.getDeclaredType().getText());
            console.log("Location", node?.getSourceFile().getFilePath());
            console.log("node Type", node?.getType().getText());
            console.log("node Type 2", symbol?.getDeclarations()[0].getKindName());
        }
        if (symbol) {
            if (kindName === "ClassDeclaration" || kindName === "MethodDeclaration" || kindName === "PropertyDeclaration") {
                this.identified.set(symbolName as string, { name: symbol?.getName(), declaration, parent });
            }
        }
    }
    getSanePath(thePath: string): string {
        return thePath.split(path.sep).join(path.posix.sep);
    }
    isTypeDefinitionNative(filePath: string): NativeTypeClassification {
        if (this.isTypeDefinitionAndroid(filePath)) {
            return { isNative: true, isAndroid: true };
        } else if (this.isTypeDefinitionIOS(filePath)) {
            return { isNative: true, isIOS: true };
        }
        return { isNative: false };
    }
    isTypeDefinitionIOS(filePath: string): boolean {
        return filePath?.includes("@nativescript/types-ios") || !!this.config.typeSources?.ios?.find((pattern) => match([filePath], pattern));
    }
    isTypeDefinitionAndroid(filePath: string): boolean {
        if (filePath?.includes("@nativescript/types-android")) {
            return true;
        }

        if (this.config.typeSources?.android) {
            for (let i = 0; i < this.config.typeSources?.android.length; ++i) {
                const isMatch = match([filePath], this.config.typeSources.android[0]);
                if (isMatch.length > 0) return true;
            }
        }

        return false;
    }
    doScan(): Map<string, SymbolInfo> {
        const project = new Project({
            tsConfigFilePath: "./tsconfig.json"
        });

        project.getSourceFiles().forEach((sourceFile) => {
            sourceFile.getDescendants().forEach((node: Node<ts.Node>) => {
                if (node.getText() == "packageId") {
                    console.log("Location package", node.getSourceFile().getFilePath());
                }

                const symbol = node.getSymbol();

                if (symbol) {
                    const decl = symbol?.getDeclarations();
                    if (decl && decl.length > 0) {
                        const declInfo = this.getDeclarationsInfo(symbol, node.getSourceFile().getFilePath());

                        if (declInfo.isInteresting) {
                            this.logDetails(node, symbol, declInfo);

                            if (declInfo.kindName === "MethodDeclaration") {
                                // get return type
                                const methodDeclaration = symbol?.getDeclarations()[0] as MethodDeclaration;
                                const returnTypeSymbol = methodDeclaration.getReturnType().getSymbol();
                                const returnSymbolNode = methodDeclaration.getReturnTypeNode();
                                this.processDeclarationNodeSymbol(returnTypeSymbol, returnSymbolNode);

                                // get param type
                                //    console.log("******   Parameters ************")
                                methodDeclaration.getParameters().forEach((value) => {
                                    this.processDeclarationNodeSymbol(value.getType().getSymbol(), value.getTypeNode());
                                });
                            }
                        }
                    }
                }
            });
        });

        return this.identified;
    }

    processDeclarationNodeSymbol(typeSymbol: Symbol | undefined, node: TypeNode<ts.TypeNode> | undefined | Node<ts.Node>): DeclarationInfo | undefined {
        if (typeSymbol && node) {
            const declInfo = this.getDeclarationsInfo(typeSymbol, "node.getSourceFile().getFilePath()");
            if (declInfo.isInteresting) {
                return declInfo;
            }
        }
    }

    walkToGetNamespaceClass(declaration: Node<ts.Node>): Array<DeclarationInfo> {
        const interestingAncestors: Array<DeclarationInfo> = [];
        const ancestors = declaration.getAncestors();
        for (const ancestor of ancestors) {
            const ancestorKind = ancestor.getKindName();
            if (ancestorKind === "ClassDeclaration") {
                interestingAncestors.push({ fullName: ancestor.getSymbol()?.getName() as string, isInteresting: true, kindName: ancestor.getKindName() });
            } else if (ancestorKind === "ModuleDeclaration") {
                const result = ancestor
                    .getFirstAncestorByKind(ts.SyntaxKind.ModuleDeclaration)
                    ?.getDescendants()
                    .find((node) => node.isKind(ts.SyntaxKind.ClassDeclaration) && node.getName() === (ancestor as ModuleDeclaration).getName());
                if (result) {
                    // console.log("Found a class for ", (ancestor as ModuleDeclaration).getName(), "So it is probably a class.");
                    interestingAncestors.push({ fullName: ancestor.getSymbol()?.getName() as string, isInteresting: true, kindName: "ClassDeclaration" });
                    continue;
                }

                interestingAncestors.push({ fullName: ancestor.getSymbol()?.getFullyQualifiedName() as string, isInteresting: true, kindName: ancestor.getKindName() });
                break;
            }
        }

        return interestingAncestors;
    }

    getDeclarationInfo(declaration: Node<ts.Node>, symbolFullName: string, anyKind = false): DeclarationInfo {
        const filePath = this.getSanePath(path.relative(this.getSanePath(process.cwd()), declaration.getSourceFile().getFilePath()));

        //  console.log("*** PATH ***", tey, this.getSanePath(process.cwd()), filePath, symbol?.getDeclarations()[0].getSourceFile().getFilePath());
        const kindName = declaration.getKindName();
        if (anyKind || kindName === "ClassDeclaration" || kindName === "MethodDeclaration" || kindName === "PropertyDeclaration") {
            const typeDefinition = this.isTypeDefinitionNative(filePath);
            if (typeDefinition.isNative) {
                const ancestors = this.walkToGetNamespaceClass(declaration);

                return {
                    fullName: symbolFullName,
                    typeClassification: typeDefinition,
                    kindName,
                    filePath,
                    isInteresting: true,
                    ancestors
                };
            }
        }
        return { fullName: symbolFullName, isInteresting: false };
    }

    getDeclarationsInfo(symbol: Symbol, sourceNodeFilePath: string): DeclarationInfo {
        const symbolFullName = symbol.getFullyQualifiedName();
        if (!sourceNodeFilePath.includes(".d.ts")) {
            for (let i = 0; i < symbol.getDeclarations().length; ++i) {
                const declaration = symbol.getDeclarations()[i];
                const info = this.getDeclarationInfo(declaration, symbolFullName);
                if (info.isInteresting) {
                    //    console.log("************" + i + " DEAL WITH MULTIPLE DECLARATIONS ******************", info.isInteresting, symbol.getFullyQualifiedName());
                    return info;
                }
            }
        }
        return { fullName: symbolFullName, isInteresting: false };
    }
}

interface NativeTypeClassification {
    isNative: boolean;
    isIOS?: boolean;
    isAndroid?: boolean;
}

interface DeclarationInfo {
    typeClassification?: NativeTypeClassification;
    filePath?: string;
    kindName?: string;
    isInteresting: boolean;
    fullName: string;
    ancestors?: Array<DeclarationInfo>;
}

interface SymbolInfo {
    name: string;
    declaration: DeclarationInfo;
    parent?: DeclarationInfo;
}
