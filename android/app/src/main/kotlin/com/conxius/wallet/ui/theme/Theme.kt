package com.conxius.wallet.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val SovereignEarthyColorScheme = lightColorScheme(
    primary = AccentEarth,
    onPrimary = PureWhite,
    primaryContainer = SurfaceVariant,
    onPrimaryContainer = BrandDeep,
    secondary = AccentForest,
    onSecondary = PureWhite,
    background = Ivory,
    onBackground = BrandDeep,
    surface = PureWhite,
    onSurface = BrandDeep,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = BrandEarth,
    outline = BrandEarth,
    outlineVariant = OutlineVariant
)

@Composable
fun ConxiusTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = SovereignEarthyColorScheme,
        content = content
    )
}
