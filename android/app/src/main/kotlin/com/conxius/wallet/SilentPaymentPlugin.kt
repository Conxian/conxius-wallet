package com.conxius.wallet

import com.getcapacitor.Plugin
import com.getcapacitor.annotation.CapacitorPlugin

/**
* No secret-bearing scan API is exposed to TypeScript. Native scans are driven by the Kotlin
* BlockSource/WalletSeedProvider boundary until a public structured-batch plugin contract is
* added with the same versioned binary format.
*/
@CapacitorPlugin(name = "SilentPayment")
class SilentPaymentPlugin : Plugin()
