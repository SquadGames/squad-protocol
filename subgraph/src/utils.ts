import { json, Bytes, ByteArray, JSONValueKind, log } from "@graphprotocol/graph-ts"

export function getType(data: string): string {
  let result = json.try_fromBytes(
    ByteArray.fromUTF8(data) as Bytes
  )
  if (result.isError) {
    log.error("Failed to parse JSON", [])
    throw new Error("Failed to parse JSON")
  }
  let object = result.value.toObject()
  let typeValue = object.get("type")
  if (typeValue.kind != JSONValueKind.STRING) {
    log.error("No valid type in JSON", [])
    throw new Error("No valid type in JSON")
  }
  return typeValue.toString()
}