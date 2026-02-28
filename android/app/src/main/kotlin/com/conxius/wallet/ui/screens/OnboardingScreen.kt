package com.conxius.wallet.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.conxius.wallet.viewmodel.OnboardingViewModel

@Composable
fun OnboardingScreen(viewModel: OnboardingViewModel, onOnboardingComplete: () -> Unit) {
    val mnemonic by viewModel.mnemonic.collectAsState()
    val isWalletCreated by viewModel.isWalletCreated.collectAsState()
    val error by viewModel.error.collectAsState()

    LaunchedEffect(isWalletCreated) {
        if (isWalletCreated && mnemonic != null) {
            // In a real app, we might wait for the "I've Backed It Up" click
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "CONXIUS ENCLAVE",
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(32.dp))

        if (mnemonic == null) {
            Button(
                onClick = { viewModel.createNewWallet() },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Create New Wallet")
            }

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = { /* Implement Import UI in next iteration */ },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
            ) {
                Text("Import Recovery Phrase")
            }
        } else {
            Text(
                text = "Your Recovery Phrase:",
                style = MaterialTheme.typography.titleMedium
            )

            Spacer(modifier = Modifier.height(8.dp))

            Card(
                modifier = Modifier.fillMaxWidth().padding(8.dp)
            ) {
                Text(
                    text = mnemonic ?: "",
                    modifier = Modifier.padding(16.dp),
                    style = MaterialTheme.typography.bodyLarge
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Write these words down and keep them safe. They are the only way to recover your wallet.",
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall
            )

            Spacer(modifier = Modifier.height(32.dp))

            Button(
                onClick = { onOnboardingComplete() },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("I've Backed It Up")
            }
        }

        error?.let {
            Spacer(modifier = Modifier.height(16.dp))
            Text(text = it, color = MaterialTheme.colorScheme.error)
        }
    }
}
