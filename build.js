const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { version } = require("./package.json");

const MAIN_JS_PATH = path.resolve(__dirname, "./dist/main.js");
const PLUGIN_NAME = `bob-plugin-zmji${version}.bobplugin`;
const ARTIFACT_PATH = path.resolve(__dirname, `./release/${PLUGIN_NAME}`);

const INFO_JSON = {
  identifier: "bob-plugin-zmji",
  version: version,
  category: "translate",
  name: "怎么记",
  minBobVersion: "0.8.0",
};

const isRelease = process.argv.includes("--release");

const initAppcast = () => {
  const fileBuffer = fs.readFileSync(ARTIFACT_PATH);
  const sum = crypto.createHash("sha256");
  sum.update(fileBuffer);
  const hex = sum.digest("hex");
  const currentVersionInfo = {
    version,
    sha256: hex,
    minBobVersion: INFO_JSON.minBobVersion,
  };
  let appcastPath = path.resolve(__dirname, "./appcast.json");
  const appcast = JSON.parse(fs.readFileSync(appcastPath, "utf-8"));
  if (!appcast.versions.find((item) => item.version === currentVersionInfo.version)) {
    appcast.versions.push(currentVersionInfo);
    fs.writeFileSync(appcastPath, JSON.stringify(appcast, null, 2), { encoding: "utf-8" });
  }
};

const createZip = () => {
  const zip = new AdmZip();
  zip.addLocalFile(MAIN_JS_PATH);
  ["icon.png"].forEach((file) => {
    zip.addLocalFile(`./static/${file}`);
  });
  zip.addFile("info.json", JSON.stringify(INFO_JSON));
  zip.writeZip(isRelease ? ARTIFACT_PATH : path.relative(__dirname, `./dist/${PLUGIN_NAME}`));
  console.log(new Date(), "Zip created");
  isRelease && initAppcast();
};

require("esbuild")
  .build({
    entryPoints: ["./src/entry.ts"],
    bundle: true,
    platform: "node",
    treeShaking: false,
    outfile: MAIN_JS_PATH,
    watch: isRelease
      ? false
      : {
          onRebuild(error, result) {
            if (error) {
              console.error("watch build failed:", error);
            } else {
              console.log("watch build succeeded:", result);
              createZip();
            }
          },
        },
  })
  .then(() => {
    createZip();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
