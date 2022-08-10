import path from "path";
import { match } from "minimatch";
import { Project, ts, Node, TypeNode, MethodDeclaration, Symbol, ModuleDeclaration, NameableNodeSpecific, PropertyDeclaration, ClassDeclaration, ExpressionWithTypeArguments } from "ts-morph";
import { IConfig } from "./config";

export class Scanner {
    constructor(private config: IConfig) {}

    private log = false;
    private identified = new ScanResults();

    private logDetails(node: Node<ts.Node> | TypeNode<ts.TypeNode> | undefined, symbol: Symbol | undefined, declaration: DeclarationInfo, parent?: DeclarationInfo) {
        const checkParent = symbol?.getDeclarations()[0]?.getParent()?.getKindName();

        const filePath = symbol?.getDeclarations()[0].getSourceFile().getFilePath();
        const kind = symbol?.getDeclarations()[0].getKind();

        let symbolName = symbol?.getFullyQualifiedName();

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
            if (kind === ts.SyntaxKind.ClassDeclaration || kind === ts.SyntaxKind.MethodDeclaration || kind === ts.SyntaxKind.PropertyDeclaration) {
                if (declaration.fullName == declaration.name && declaration.ancestors?.length) {
                    symbolName = declaration.name + declaration.ancestors[0].fullName;
                }

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
    doScan(): ScanResults {
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
                        const declInfos = this.getInterestingDeclarationsInfo(symbol, node.getSourceFile().getFilePath());
                        for (const declInfo of declInfos) {
                            if (declInfo.isInteresting) {
                                this.logDetails(node, symbol, declInfo);

                                // if this is a class then get the interfaces/classes it extends/implements ?
                                if (declInfo.kind === ts.SyntaxKind.ClassDeclaration) {
                                    for (const classDeclarationNode of symbol.getDeclarations()) {
                                        if (classDeclarationNode.getKind() == ts.SyntaxKind.ClassDeclaration) {
                                            const classDeclaration: ClassDeclaration = classDeclarationNode as ClassDeclaration;
                                            const extendedTypes: ExpressionWithTypeArguments[] = [];

                                            const classExtended = classDeclaration.getExtends();
                                            if (classExtended) {
                                                extendedTypes.push(classExtended);
                                            }
                                            const interfaces = classDeclaration.getImplements();
                                            if (interfaces && interfaces.length > 0) {
                                                extendedTypes.push(...interfaces);
                                            }
                                            this.processExtended(extendedTypes);
                                        }
                                    }
                                }

                                if (declInfo.kind === ts.SyntaxKind.MethodDeclaration) {
                                    for (const methodDeclarationNode of symbol.getDeclarations()) {
                                        //const methodDeclaration = symbol?.getDeclarations()[0] as MethodDeclaration;
                                        const methodDeclaration: MethodDeclaration = methodDeclarationNode as MethodDeclaration;
                                        const returnTypeSymbol = methodDeclaration.getReturnType().getSymbol();
                                        const returnSymbolNode = methodDeclaration.getReturnTypeNode();
                                        const returnDecl = this.processDeclarationNodeSymbol(returnTypeSymbol, returnSymbolNode);
                                        if (returnDecl?.isInteresting) {
                                            this.logDetails(returnSymbolNode, returnTypeSymbol, returnDecl);
                                        }
                                        // get param type
                                        //    console.log("******   Parameters ************")
                                        methodDeclaration.getParameters().forEach((value) => {
                                            const paramDecl = this.processDeclarationNodeSymbol(value.getType().getSymbol(), value.getTypeNode());
                                            if (paramDecl?.isInteresting) {
                                                this.logDetails(value.getTypeNode(), value.getType().getSymbol(), paramDecl);
                                            }
                                        });
                                    }
                                    // get return type
                                } else if (declInfo.kind === ts.SyntaxKind.PropertyDeclaration) {
                                    for (const propertyDeclarationNode of symbol.getDeclarations()) {
                                        const propertyDeclaration: PropertyDeclaration = propertyDeclarationNode as PropertyDeclaration;
                                        if (propertyDeclaration) {
                                            const returnTypeSymbol = propertyDeclaration.getType().getSymbol();
                                            const returnSymbolNode = propertyDeclaration.getTypeNode();
                                            const returnDecl = this.processDeclarationNodeSymbol(returnTypeSymbol, returnSymbolNode);
                                            if (returnDecl?.isInteresting) {
                                                this.logDetails(returnSymbolNode, returnTypeSymbol, returnDecl);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        });

        return this.identified;
    }
    processExtended(extendedTypes: ExpressionWithTypeArguments[]) {
        if (extendedTypes && extendedTypes.length > 0) {
            for (const extendedType of extendedTypes) {
                const typeSymbol = extendedType.getType().getSymbol();

                const returnDecl = this.processDeclarationNodeSymbol(typeSymbol, extendedType);
                if (returnDecl?.isInteresting) {
                    this.logDetails(extendedType, typeSymbol, returnDecl);
                }
                const typeArgs = extendedType.getTypeArguments();
                for (const typeArg of typeArgs) {
                    const returnDecl = this.processDeclarationNodeSymbol(typeArg.getSymbol(), typeArg);
                    if (returnDecl?.isInteresting) {
                        this.logDetails(typeArg, typeArg.getSymbol(), returnDecl);
                    }
                }
            }
        }
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
            const ancestorKind = ancestor.getKind();
            if (ancestorKind === ts.SyntaxKind.ClassDeclaration) {
                interestingAncestors.push({
                    fullName: ancestor.getSymbol()?.getFullyQualifiedName() as string,
                    name: ancestor.getSymbol()?.getName() as string,
                    isInteresting: true,
                    kindName: ancestor.getKindName(),
                    kind: ancestorKind
                });
            } else if (ancestorKind === ts.SyntaxKind.ModuleDeclaration) {
                const result = ancestor
                    .getFirstAncestorByKind(ts.SyntaxKind.ModuleDeclaration)
                    ?.getDescendants()
                    .find((node) => node.isKind(ts.SyntaxKind.ClassDeclaration) && node.getName() === (ancestor as ModuleDeclaration).getName());
                if (result) {
                    // console.log("Found a class for ", (ancestor as ModuleDeclaration).getName(), "So it is probably a class.");
                    interestingAncestors.push({
                        name: ancestor.getSymbol()?.getName() as string,
                        fullName: ancestor.getSymbol()?.getFullyQualifiedName() as string,
                        isInteresting: true,
                        kindName: "ClassDeclaration",
                        kind: ts.SyntaxKind.ClassDeclaration
                    });
                    continue;
                }

                interestingAncestors.push({
                    name: ancestor.getSymbol()?.getName() as string,
                    fullName: ancestor.getSymbol()?.getFullyQualifiedName() as string,
                    isInteresting: true,
                    kindName: ancestor.getKindName(),
                    kind: ancestor.getKind()
                });
                break;
            }
        }

        return interestingAncestors;
    }

    getDeclarationInfo(declaration: Node<ts.Node>, symbolFullName: string, anyKind = false): DeclarationInfo {
        const filePath = this.getSanePath(path.relative(this.getSanePath(process.cwd()), declaration.getSourceFile().getFilePath()));

        //  console.log("*** PATH ***", tey, this.getSanePath(process.cwd()), filePath, symbol?.getDeclarations()[0].getSourceFile().getFilePath());
        const kind = declaration.getKind();

        if (anyKind || kind === ts.SyntaxKind.ClassDeclaration || kind === ts.SyntaxKind.MethodDeclaration || kind === ts.SyntaxKind.PropertyDeclaration) {
            const typeDefinition = this.isTypeDefinitionNative(filePath);
            if (typeDefinition.isNative) {
                const ancestors = this.walkToGetNamespaceClass(declaration);

                return {
                    name: (declaration as unknown as NameableNodeSpecific).getName() as string,
                    fullName: symbolFullName,
                    typeClassification: typeDefinition,
                    kindName: declaration.getKindName(),
                    filePath,
                    isInteresting: true,
                    ancestors,
                    kind: declaration.getKind()
                };
            }
        }
        return { name: "", fullName: symbolFullName, isInteresting: false, kind: declaration.getKind() };
    }

    getInterestingDeclarationsInfo(symbol: Symbol, sourceNodeFilePath: string): DeclarationInfo[] {
        const interesting: DeclarationInfo[] = [];
        const symbolFullName = symbol.getFullyQualifiedName();
        if (!sourceNodeFilePath.includes(".d.ts")) {
            for (const declaration of symbol.getDeclarations()) {
                const info = this.getDeclarationInfo(declaration, symbolFullName);
                if (info.isInteresting) {
                    //    console.log("************" + i + " DEAL WITH MULTIPLE DECLARATIONS ******************", info.isInteresting, symbol.getFullyQualifiedName());
                    interesting.push(info);
                }
            }
        }
        return interesting;
    }

    getDeclarationsInfo(symbol: Symbol, sourceNodeFilePath: string): DeclarationInfo {
        const symbolFullName = symbol.getFullyQualifiedName();
        if (!sourceNodeFilePath.includes(".d.ts")) {
            for (const declaration of symbol.getDeclarations()) {
                const info = this.getDeclarationInfo(declaration, symbolFullName);
                if (info.isInteresting) {
                    //    console.log("************" + i + " DEAL WITH MULTIPLE DECLARATIONS ******************", info.isInteresting, symbol.getFullyQualifiedName());
                    return info;
                }
            }
        }
        return { name: "", fullName: symbolFullName, isInteresting: false, kind: ts.SyntaxKind.Unknown };
    }
}

export interface NativeTypeClassification {
    isNative: boolean;
    isIOS?: boolean;
    isAndroid?: boolean;
}

export interface DeclarationInfo {
    typeClassification?: NativeTypeClassification;
    filePath?: string;
    kindName?: string;
    kind: ts.SyntaxKind;
    isInteresting: boolean;
    fullName: string;
    name: string;
    ancestors?: Array<DeclarationInfo>;
}

export interface SymbolInfo {
    name: string;
    declaration: DeclarationInfo;
    parent?: DeclarationInfo;
}

export class ScanResults {
    public ios: Map<string, SymbolInfo> = new Map<string, SymbolInfo>();
    public android: Map<string, SymbolInfo> = new Map<string, SymbolInfo>();

    public set(name: string, symbolInfo: SymbolInfo) {
        if (symbolInfo.declaration.typeClassification?.isAndroid) {
            this.android.set(name, symbolInfo);
        } else if (symbolInfo.declaration.typeClassification?.isIOS) {
            this.ios.set(name, symbolInfo);
        }
    }
}
