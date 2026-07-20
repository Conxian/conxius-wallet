package com.conxius.wallet.bitcoin

import java.util.Arrays

/**
* Supplies wallet mnemonic material only for the duration of one native scan call.
*
* Implementations should decrypt from Room/StrongBox immediately before invoking [block], must
* not retain or log the arrays, and should clear their own copies after [block] returns. The
* manager also clears the arrays in a `finally` block, so providers must treat the arrays as
* borrowed mutable buffers and never use them after the callback completes.
*/
interface WalletSeedProvider {
    suspend fun <T> withSeed(block: suspend (WalletSeedMaterial) -> T): T
}

/** Borrowed secret bytes exposed only inside [WalletSeedProvider.withSeed]. */
class WalletSeedMaterial(
    val mnemonicBytes: ByteArray,
    val passphraseBytes: ByteArray?,
) {
    internal fun clear() {
        Arrays.fill(mnemonicBytes, 0.toByte())
        passphraseBytes?.let { Arrays.fill(it, 0.toByte()) }
    }
}

/** Production default until Room + StrongBox wiring supplies a real wallet seed. */
object UnavailableWalletSeedProvider : WalletSeedProvider {
    override suspend fun <T> withSeed(block: suspend (WalletSeedMaterial) -> T): T {
        throw NativeSilentPaymentException(NativeErrorCode.INVALID_SECRET)
    }
}
