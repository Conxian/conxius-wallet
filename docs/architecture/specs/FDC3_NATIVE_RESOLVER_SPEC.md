# Technical Specification: FDC3 Native Android Resolver (CON-1181)

**Version:** 1.0
**Status:** DRAFT
**Owner:** Sovereign Engineering

## 1. Overview
FDC3 (Financial Desktop Connectivity and Collaboration) allows financial apps to interoperate. This spec defines a native Android bridge to support FDC3 intents like `ViewAsset` and `InitiateSettlement`.

## 2. Intent Registration

### 2.1 AndroidManifest.xml
Conxius Wallet will register to handle FDC3 intents via custom actions and data types.

```xml
<intent-filter>
    <action android:name="com.finos.fdc3.intent.VIEW_INSTRUMENT" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="application/vnd.fdc3.instrument+json" />
</intent-filter>
```

## 3. Bridge Implementation (Fdc3Plugin.kt)

### 3.1 Plugin Methods
- `raiseIntent(intent: String, context: JSObject)`: Maps a TS call to `Context.startActivity(Intent)`.
- `addContextListener(type: String)`: Registers a broadcast receiver for incoming FDC3 contexts.

### 3.2 Data Mapping
FDC3 context types (JSON) are mapped to Android `Bundle` extras:
- `fdc3.instrument` -> `Bundle.putString("ticker", ticker)`, `Bundle.putString("isin", isin)`.

## 4. UI/UX Flow
1. User clicks "View in Conxius" in a corporate treasury app (Gateway).
2. Gateway calls `fdc3.raiseIntent("ViewInstrument", { type: "fdc3.instrument", id: { ticker: "BTC" } })`.
3. Android system displays the "Open with" picker.
4. Conxius Wallet opens directly to the Bitcoin asset page.

## 5. Security
- **Origin Validation**: Only "Trusted Origins" (configured in `ai-security.ts`) can raise high-privilege intents like `InitiateSettlement`.
