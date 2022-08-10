Examines the typescript code of Nativescript Project/Plugin, outputting the types determined to be Native types.

## Installation

```
npm i -g @jcassidyav/generate-metadata-filter@alpha
```

## Usage

1. Create a config file named `.generate-metadata-filter.json` in the root of your app, or the root of the plugin source code, e.g `packages/mypackage`.
2. Add paths to any type definitions you have added for custom native types.

    ```
    {

        "typeSources":{
            "ios": [],
            "android": ["ns-typings/android/*"]
        },
        "mode":"plugin"
    }
    ```

3. Execute command `generate-metadata-filter` in the same directory.
