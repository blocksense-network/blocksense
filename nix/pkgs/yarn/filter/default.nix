{ lib }:
inFolders:
let
  folders = inFolders ++ [
    "libs/ts/base-utils"
    "apps/rollup"
  ];
in
lib.fileset.toSource rec {
  root = ../../../..;
  fileset = lib.fileset.unions (
    [
      (root + "/yarn.lock")
      (root + "/.yarnrc.yml")
      (root + "/.yarn")
      (root + "/package.json")
      (root + "/tsconfig.base.json")

    ]
    ++ (lib.flatten (
      lib.map (folder: [
        (lib.fileset.maybeMissing (root + "/${folder}/assets"))
        (lib.fileset.fileFilter (
          file:
          (builtins.any file.hasExt [
            "ts"
            "tsx"
            "js"
            "cjs"
            "mjs"
            "css"
            "html"
          ])
          || (file.name == "package.json")
          || (file.name == "tsconfig.json")
          || (file.name == "tsconfig.base.json")
        ) (root + ("/" + folder)))
      ]) folders
    ))
  );
}
