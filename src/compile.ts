import path from "path";
import { match } from "minimatch";
import { Project, ts, Node, TypeNode, MethodDeclaration, Symbol } from "ts-morph";
import { IConfig } from "./config";

export class Scanner {
    constructor(private config: IConfig) {}
    private identified = new Map<string, { kind: string; declared: string }>();
    private log = false;
    // eslint-disable-next-line @typescript-eslint/ban-types
    private logDetails(node: Node<ts.Node> | TypeNode<ts.TypeNode> | undefined, symbol: Symbol | undefined) {
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

        if (kindName === "ClassDeclaration" || kindName === "MethodDeclaration" || kindName === "PropertyDeclaration") {
            this.identified.set(symbolName as string, { kind: kindName, declared: filePath as string });
        }
    }
    getSanePath(thePath: string): string {
        return thePath.split(path.sep).join(path.posix.sep);
    }
    isTypeDefinitionNative(filePath: string) {
        return this.isTypeDefinitionAndroid(filePath) || this.isTypeDefinitionIOS(filePath);
    }
    isTypeDefinitionIOS(filePath: string): boolean {
        return filePath?.includes("@nativescript\\types-ios") || !!this.config.typeSources?.ios?.find((pattern) => match([filePath], pattern));
    }
    isTypeDefinitionAndroid(filePath: string): boolean {
        return (
            filePath?.includes("@nativescript\\types-android") ||
            !!this.config.typeSources?.android?.find((pattern) => {
                return match([filePath], pattern);
            })
        );
    }
    doScan() {
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
                        const filePath = path.relative(this.getSanePath(process.cwd()), symbol?.getDeclarations()[0].getSourceFile().getFilePath());
                        //  console.log("*** PATH ***", tey, this.getSanePath(process.cwd()), filePath, symbol?.getDeclarations()[0].getSourceFile().getFilePath());
                        const kindName = symbol?.getDeclarations()[0].getKindName();
                        //     const symbolName = symbol?.getFullyQualifiedName();

                        if (kindName === "ClassDeclaration" || kindName === "MethodDeclaration" || kindName === "PropertyDeclaration") {
                            if (this.isTypeDefinitionNative(filePath) && !node.getSourceFile().getFilePath().includes(".d.ts")) {
                                //   console.log("********  Interesting Node ***************");
                                //  console.log("node", node.getType().getCallSignatures()[0].getReturnType().getSymbol()?.getFullyQualifiedName())
                                this.logDetails(node, symbol);

                                if (kindName === "MethodDeclaration") {
                                    // get return type
                                    const decl = symbol?.getDeclarations()[0] as MethodDeclaration;
                                    const returnTypeSymbol = decl.getReturnType().getSymbol();
                                    const returnSymbolNode = decl.getReturnTypeNode();
                                    //   console.log("******   Return Type ************")
                                    this.logDetails(returnSymbolNode, returnTypeSymbol);

                                    // get param type
                                    //    console.log("******   Parameters ************")
                                    decl.getParameters().forEach((value) => {
                                        this.logDetails(value.getTypeNode(), value.getType().getSymbol());
                                    });
                                }
                            }
                        }
                    }
                }
            });
        });

        console.log("*********** Identified *************");
        this.identified.forEach((value, key) => {
            console.log(key, JSON.stringify(value));
        });
    }
}
