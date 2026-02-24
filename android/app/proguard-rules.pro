# Conxius Wallet ProGuard Rules

# bitcoinj
-keep class org.bitcoinj.** { *; }
-dontwarn org.bitcoinj.**
-keep class org.bitcoin.** { *; }

# web3j
-keep class org.web3j.** { *; }
-dontwarn org.web3j.**
-keep class okhttp3.** { *; }
-dontwarn okhttp3.**
-keep class rx.** { *; }
-dontwarn rx.**

# BouncyCastle
-keep class org.bouncycastle.** { *; }
-dontwarn org.bouncycastle.**

# Breez SDK
-keep class breez_sdk.** { *; }
-dontwarn breez_sdk.**

# Capacitor
-keep class com.getcapacitor.** { *; }
-keep class com.conxius.wallet.** { *; }

# Jackson (often used by web3j)
-keep class com.fasterxml.jackson.** { *; }
-dontwarn com.fasterxml.jackson.**

# Protobuf (used by bitcoinj)
-keep class com.google.protobuf.** { *; }
