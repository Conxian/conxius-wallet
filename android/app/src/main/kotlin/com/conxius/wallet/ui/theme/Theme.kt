package com.conxius.wallet.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = BrandEarth,
    onPrimary = PureWhite,
    primaryContainer = WarmOffWhite,
    onPrimaryContainer = BrandDeep,
    secondary = AccentForest,
    onSecondary = PureWhite,
    tertiary = AccentEarth,
    onTertiary = PureWhite,
    background = Ivory,
    onBackground = DeepBlack,
    surface = PureWhite,
    onSurface = BrandDeep,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = BrandDeep,
    outline = BrandEarth,
    outlineVariant = OutlineVariant
)

private val AppTypography = Typography()

@Composable
fun ConxiusTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    // Note: Conxius v1.9.5 mandates the 'Sovereign Earthy' bright foundation.
    // Dark theme is currently suppressed for primary operational views.
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = AppTypography,
        content = content
    )
}
