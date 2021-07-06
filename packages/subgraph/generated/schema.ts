// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import {
  TypedMap,
  Entity,
  Value,
  ValueKind,
  store,
  Address,
  Bytes,
  BigInt,
  BigDecimal
} from "@graphprotocol/graph-ts";

export class Content extends Entity {
  constructor(id: string) {
    super();
    this.set("id", Value.fromString(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id !== null, "Cannot save Content entity without an ID");
    assert(
      id.kind == ValueKind.STRING,
      "Cannot save Content entity with non-string ID. " +
        'Considering using .toHex() to convert the "id" to a string.'
    );
    store.set("Content", id.toString(), this);
  }

  static load(id: string): Content | null {
    return store.get("Content", id) as Content | null;
  }

  get id(): string {
    let value = this.get("id");
    return value.toString();
  }

  set id(value: string) {
    this.set("id", Value.fromString(value));
  }

  get nftAddress(): Bytes {
    let value = this.get("nftAddress");
    return value.toBytes();
  }

  set nftAddress(value: Bytes) {
    this.set("nftAddress", Value.fromBytes(value));
  }

  get nftId(): BigInt {
    let value = this.get("nftId");
    return value.toBigInt();
  }

  set nftId(value: BigInt) {
    this.set("nftId", Value.fromBigInt(value));
  }

  get licenses(): Array<string> {
    let value = this.get("licenses");
    return value.toStringArray();
  }

  set licenses(value: Array<string>) {
    this.set("licenses", Value.fromStringArray(value));
  }
}

export class PurchasableLicense extends Entity {
  constructor(id: string) {
    super();
    this.set("id", Value.fromString(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id !== null, "Cannot save PurchasableLicense entity without an ID");
    assert(
      id.kind == ValueKind.STRING,
      "Cannot save PurchasableLicense entity with non-string ID. " +
        'Considering using .toHex() to convert the "id" to a string.'
    );
    store.set("PurchasableLicense", id.toString(), this);
  }

  static load(id: string): PurchasableLicense | null {
    return store.get("PurchasableLicense", id) as PurchasableLicense | null;
  }

  get id(): string {
    let value = this.get("id");
    return value.toString();
  }

  set id(value: string) {
    this.set("id", Value.fromString(value));
  }

  get licenseManagerAddress(): Bytes {
    let value = this.get("licenseManagerAddress");
    return value.toBytes();
  }

  set licenseManagerAddress(value: Bytes) {
    this.set("licenseManagerAddress", Value.fromBytes(value));
  }

  get content(): string {
    let value = this.get("content");
    return value.toString();
  }

  set content(value: string) {
    this.set("content", Value.fromString(value));
  }

  get contentOwnerWhenRegistered(): Bytes {
    let value = this.get("contentOwnerWhenRegistered");
    return value.toBytes();
  }

  set contentOwnerWhenRegistered(value: Bytes) {
    this.set("contentOwnerWhenRegistered", Value.fromBytes(value));
  }

  get price(): BigInt {
    let value = this.get("price");
    return value.toBigInt();
  }

  set price(value: BigInt) {
    this.set("price", Value.fromBigInt(value));
  }

  get sharePercentage(): i32 {
    let value = this.get("sharePercentage");
    return value.toI32();
  }

  set sharePercentage(value: i32) {
    this.set("sharePercentage", Value.fromI32(value));
  }

  get licenseTokenAddress(): Bytes {
    let value = this.get("licenseTokenAddress");
    return value.toBytes();
  }

  set licenseTokenAddress(value: Bytes) {
    this.set("licenseTokenAddress", Value.fromBytes(value));
  }
}

export class RevShareLicense extends Entity {
  constructor(id: string) {
    super();
    this.set("id", Value.fromString(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id !== null, "Cannot save RevShareLicense entity without an ID");
    assert(
      id.kind == ValueKind.STRING,
      "Cannot save RevShareLicense entity with non-string ID. " +
        'Considering using .toHex() to convert the "id" to a string.'
    );
    store.set("RevShareLicense", id.toString(), this);
  }

  static load(id: string): RevShareLicense | null {
    return store.get("RevShareLicense", id) as RevShareLicense | null;
  }

  get id(): string {
    let value = this.get("id");
    return value.toString();
  }

  set id(value: string) {
    this.set("id", Value.fromString(value));
  }

  get licenseManagerAddress(): Bytes {
    let value = this.get("licenseManagerAddress");
    return value.toBytes();
  }

  set licenseManagerAddress(value: Bytes) {
    this.set("licenseManagerAddress", Value.fromBytes(value));
  }

  get content(): string {
    let value = this.get("content");
    return value.toString();
  }

  set content(value: string) {
    this.set("content", Value.fromString(value));
  }

  get contentOwnerWhenRegistered(): Bytes {
    let value = this.get("contentOwnerWhenRegistered");
    return value.toBytes();
  }

  set contentOwnerWhenRegistered(value: Bytes) {
    this.set("contentOwnerWhenRegistered", Value.fromBytes(value));
  }

  get minSharePercentage(): i32 {
    let value = this.get("minSharePercentage");
    return value.toI32();
  }

  set minSharePercentage(value: i32) {
    this.set("minSharePercentage", Value.fromI32(value));
  }
}

export class PurchaseEvent extends Entity {
  constructor(id: string) {
    super();
    this.set("id", Value.fromString(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id !== null, "Cannot save PurchaseEvent entity without an ID");
    assert(
      id.kind == ValueKind.STRING,
      "Cannot save PurchaseEvent entity with non-string ID. " +
        'Considering using .toHex() to convert the "id" to a string.'
    );
    store.set("PurchaseEvent", id.toString(), this);
  }

  static load(id: string): PurchaseEvent | null {
    return store.get("PurchaseEvent", id) as PurchaseEvent | null;
  }

  get id(): string {
    let value = this.get("id");
    return value.toString();
  }

  set id(value: string) {
    this.set("id", Value.fromString(value));
  }

  get content(): string {
    let value = this.get("content");
    return value.toString();
  }

  set content(value: string) {
    this.set("content", Value.fromString(value));
  }

  get purchaser(): Bytes {
    let value = this.get("purchaser");
    return value.toBytes();
  }

  set purchaser(value: Bytes) {
    this.set("purchaser", Value.fromBytes(value));
  }

  get licensesBought(): BigInt {
    let value = this.get("licensesBought");
    return value.toBigInt();
  }

  set licensesBought(value: BigInt) {
    this.set("licensesBought", Value.fromBigInt(value));
  }

  get pricePaid(): BigInt {
    let value = this.get("pricePaid");
    return value.toBigInt();
  }

  set pricePaid(value: BigInt) {
    this.set("pricePaid", Value.fromBigInt(value));
  }

  get licenseTokenAddress(): Bytes {
    let value = this.get("licenseTokenAddress");
    return value.toBytes();
  }

  set licenseTokenAddress(value: Bytes) {
    this.set("licenseTokenAddress", Value.fromBytes(value));
  }

  get blockNumber(): BigInt {
    let value = this.get("blockNumber");
    return value.toBigInt();
  }

  set blockNumber(value: BigInt) {
    this.set("blockNumber", Value.fromBigInt(value));
  }
}

export class Royalties extends Entity {
  constructor(id: string) {
    super();
    this.set("id", Value.fromString(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id !== null, "Cannot save Royalties entity without an ID");
    assert(
      id.kind == ValueKind.STRING,
      "Cannot save Royalties entity with non-string ID. " +
        'Considering using .toHex() to convert the "id" to a string.'
    );
    store.set("Royalties", id.toString(), this);
  }

  static load(id: string): Royalties | null {
    return store.get("Royalties", id) as Royalties | null;
  }

  get id(): string {
    let value = this.get("id");
    return value.toString();
  }

  set id(value: string) {
    this.set("id", Value.fromString(value));
  }

  get totalClaimableBalance(): BigInt {
    let value = this.get("totalClaimableBalance");
    return value.toBigInt();
  }

  set totalClaimableBalance(value: BigInt) {
    this.set("totalClaimableBalance", Value.fromBigInt(value));
  }
}

export class Window extends Entity {
  constructor(id: string) {
    super();
    this.set("id", Value.fromString(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id !== null, "Cannot save Window entity without an ID");
    assert(
      id.kind == ValueKind.STRING,
      "Cannot save Window entity with non-string ID. " +
        'Considering using .toHex() to convert the "id" to a string.'
    );
    store.set("Window", id.toString(), this);
  }

  static load(id: string): Window | null {
    return store.get("Window", id) as Window | null;
  }

  get id(): string {
    let value = this.get("id");
    return value.toString();
  }

  set id(value: string) {
    this.set("id", Value.fromString(value));
  }

  get index(): BigInt {
    let value = this.get("index");
    return value.toBigInt();
  }

  set index(value: BigInt) {
    this.set("index", Value.fromBigInt(value));
  }

  get fundsAvailable(): BigInt {
    let value = this.get("fundsAvailable");
    return value.toBigInt();
  }

  set fundsAvailable(value: BigInt) {
    this.set("fundsAvailable", Value.fromBigInt(value));
  }

  get merkleRoot(): Bytes {
    let value = this.get("merkleRoot");
    return value.toBytes();
  }

  set merkleRoot(value: Bytes) {
    this.set("merkleRoot", Value.fromBytes(value));
  }

  get blockNumber(): BigInt {
    let value = this.get("blockNumber");
    return value.toBigInt();
  }

  set blockNumber(value: BigInt) {
    this.set("blockNumber", Value.fromBigInt(value));
  }
}

export class Transfer extends Entity {
  constructor(id: string) {
    super();
    this.set("id", Value.fromString(id));
  }

  save(): void {
    let id = this.get("id");
    assert(id !== null, "Cannot save Transfer entity without an ID");
    assert(
      id.kind == ValueKind.STRING,
      "Cannot save Transfer entity with non-string ID. " +
        'Considering using .toHex() to convert the "id" to a string.'
    );
    store.set("Transfer", id.toString(), this);
  }

  static load(id: string): Transfer | null {
    return store.get("Transfer", id) as Transfer | null;
  }

  get id(): string {
    let value = this.get("id");
    return value.toString();
  }

  set id(value: string) {
    this.set("id", Value.fromString(value));
  }

  get to(): Bytes {
    let value = this.get("to");
    return value.toBytes();
  }

  set to(value: Bytes) {
    this.set("to", Value.fromBytes(value));
  }

  get amount(): BigInt {
    let value = this.get("amount");
    return value.toBigInt();
  }

  set amount(value: BigInt) {
    this.set("amount", Value.fromBigInt(value));
  }

  get blockNumber(): BigInt {
    let value = this.get("blockNumber");
    return value.toBigInt();
  }

  set blockNumber(value: BigInt) {
    this.set("blockNumber", Value.fromBigInt(value));
  }
}