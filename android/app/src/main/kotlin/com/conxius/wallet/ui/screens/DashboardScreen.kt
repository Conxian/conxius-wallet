package com.conxius.wallet.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.conxius.wallet.viewmodel.WalletViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(viewModel: WalletViewModel) {
    val assets by viewModel.assets.collectAsState()
    val isLocked by viewModel.isLocked.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sovereignty") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .padding(paddingValues)
                .fillMaxSize()
                .padding(16.dp)
        ) {
            Text(
                text = "Total Balance",
                style = MaterialTheme.typography.labelLarge
            )
            Text(
                text = "₿ 0.00000000",
                style = MaterialTheme.typography.headlineMedium
            )

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Assets",
                style = MaterialTheme.typography.titleMedium
            )

            LazyColumn {
                items(assets) { asset ->
                    AssetRow(asset.name, asset.balance, asset.symbol)
                }
            }
        }
    }
}

@Composable
fun AssetRow(name: String, balance: String, symbol: String) {
    ListItem(
        headlineContent = { Text(name) },
        trailingContent = { Text("$balance $symbol") }
    )
    HorizontalDivider()
}
