package com.conxius.wallet.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.conxius.wallet.bitcoin.MAX_SCAN_BLOCKS
import com.conxius.wallet.bitcoin.SilentPaymentNetwork
import com.conxius.wallet.scan.SilentPaymentScanState

/**
* Public-only Compose entry point for the shipped Android scan path.
*
* The card deliberately exposes only a fixed production network and an explicit bounded block
* range. Seed material, scan keys, endpoints, and Capacitor calls do not cross this UI boundary.
*/
@Composable
fun SilentPaymentScanCard(
    scanState: SilentPaymentScanState,
    onStart: (SilentPaymentNetwork, Long, Long) -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var startHeightText by rememberSaveable { mutableStateOf("") }
    var endHeightText by rememberSaveable { mutableStateOf("") }
    val startHeight = startHeightText.toLongOrNull()
    val endHeight = endHeightText.toLongOrNull()
    val validationError = validateScanRange(startHeightText, endHeightText, startHeight, endHeight)
    val isScanning = scanState is SilentPaymentScanState.Scanning
    val canStart = !isScanning && validationError == null && startHeight != null && endHeight != null

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Silent payment scan",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "Native Android path: Compose → WalletViewModel → coordinator",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Network: MAINNET (Bitcoin mainnet)",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                TextField(
                    value = startHeightText,
                    onValueChange = { startHeightText = it.filter(Char::isDigit) },
                    label = { Text("Start height") },
                    singleLine = true,
                    enabled = !isScanning,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                )
                TextField(
                    value = endHeightText,
                    onValueChange = { endHeightText = it.filter(Char::isDigit) },
                    label = { Text("End height") },
                    singleLine = true,
                    enabled = !isScanning,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                )
            }

            validationError?.let {
                Text(
                    text = it,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }

            Spacer(modifier = Modifier.height(12.dp))
            ScanStateContent(scanState)
            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Button(
                    onClick = {
                        if (startHeight != null && endHeight != null) {
                            onStart(SilentPaymentNetwork.MAINNET, startHeight, endHeight)
                        }
                    },
                    enabled = canStart,
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Start scan")
                }
                OutlinedButton(
                    onClick = onCancel,
                    enabled = isScanning,
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Cancel scan")
                }
            }
        }
    }
}

@Composable
private fun ScanStateContent(scanState: SilentPaymentScanState) {
    when (scanState) {
        SilentPaymentScanState.Idle -> Text("Ready to scan an explicit block range.")
        is SilentPaymentScanState.Scanning -> {
            val progress = scanState.progress
            val totalBlocks = (progress.endHeight - progress.startHeight + 1L).coerceAtLeast(1L)
            val fraction = (progress.scannedBlocks.toFloat() / totalBlocks.toFloat()).coerceIn(0f, 1f)
            Text(
                text = "Scanning${progress.currentHeight?.let { " block $it" } ?: ""}…",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
            )
            LinearProgressIndicator(
                progress = { fraction },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
            )
            ScanMetrics(
                scannedBlocks = progress.scannedBlocks,
                scannedTransactions = progress.scannedTransactions,
                matchCount = progress.matchCount,
                persistedCount = null,
            )
        }
        is SilentPaymentScanState.Completed -> {
            val metrics = scanState.report.metrics
            Text(
                text = "Completed",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.primary,
            )
            ScanMetrics(
                scannedBlocks = metrics.scannedBlocks,
                scannedTransactions = metrics.scannedTransactions,
                matchCount = metrics.matchCount,
                persistedCount = scanState.report.utxos.size.toLong(),
            )
        }
        is SilentPaymentScanState.Failed -> Text(
            text = "Failed: ${scanState.code.name}",
            color = MaterialTheme.colorScheme.error,
            fontWeight = FontWeight.SemiBold,
        )
        SilentPaymentScanState.Cancelled -> Text(
            text = "Cancelled: CANCELLED",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun ScanMetrics(
    scannedBlocks: Long,
    scannedTransactions: Long,
    matchCount: Long,
    persistedCount: Long?,
) {
    Column(modifier = Modifier.padding(top = 8.dp)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            ScanMetric("Blocks", scannedBlocks.toString(), Modifier.weight(1f))
            ScanMetric("Transactions", scannedTransactions.toString(), Modifier.weight(1f))
        }
        Row(modifier = Modifier.fillMaxWidth()) {
            ScanMetric("Matches", matchCount.toString(), Modifier.weight(1f))
            ScanMetric("Persisted UTXOs", persistedCount?.toString() ?: "—", Modifier.weight(1f))
        }
    }
}

@Composable
private fun ScanMetric(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier.padding(top = 4.dp)) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
    }
}

private fun validateScanRange(
    startText: String,
    endText: String,
    startHeight: Long?,
    endHeight: Long?,
): String? {
    if (startText.isBlank() || endText.isBlank()) return "Enter both start and end heights."
    if (startHeight == null || endHeight == null) return "Heights must be valid non-negative integers."
    if (startHeight > endHeight) return "Start height must not exceed end height."
    val span = runCatching { Math.subtractExact(endHeight, startHeight) }.getOrNull()
        ?: return "The requested range is too large."
    if (span >= MAX_SCAN_BLOCKS) return "The range must be smaller than $MAX_SCAN_BLOCKS blocks."
    return null
}
