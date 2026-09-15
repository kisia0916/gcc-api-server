import fs from "node:fs"
import path from "node:path"
import { isNonEmptyString } from "./http"

const sourceArgument = process.argv[2] || process.env.LAUNCHER_CATALOG_PATH
if (!sourceArgument) {
    throw new Error("Pass the launcher game_info.json path as the first argument")
}

const sourcePath = path.resolve(sourceArgument)
const outputPath = path.resolve(process.cwd(), "game_info.json")
const source = JSON.parse(fs.readFileSync(sourcePath, "utf-8")) as Record<string, unknown>
const genres = Array.isArray(source.genres) ? source.genres.filter(isNonEmptyString) : []
if (genres.length === 0) throw new Error("The launcher catalog has no genres")

const output: Record<string, unknown> = { schemaVersion: 2, genres }
let total = 0
for (const genre of genres) {
    const entries = source[genre]
    if (!Array.isArray(entries)) throw new Error(`Missing game list for genre: ${genre}`)
    output[genre] = entries.map((entry, index) => {
        if (!entry || typeof entry !== "object") {
            throw new Error(`Invalid entry: ${genre}[${index}]`)
        }
        const game = entry as Record<string, unknown>
        if (!isNonEmptyString(game.title)) {
            throw new Error(`Missing title: ${genre}[${index}]`)
        }
        total += 1
        return { title: game.title.trim(), genre }
    })
}

const temporaryPath = `${outputPath}.tmp`
fs.writeFileSync(temporaryPath, `${JSON.stringify(output, null, 2)}\n`, "utf-8")
fs.renameSync(temporaryPath, outputPath)
console.log(`Synchronized ${total} games from ${sourcePath}`)
