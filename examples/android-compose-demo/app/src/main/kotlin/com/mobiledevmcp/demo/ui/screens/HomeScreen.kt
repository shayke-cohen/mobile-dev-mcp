/**
 * Home Screen
 */

package com.mobiledevmcp.demo.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.mobiledevmcp.demo.BuildConfig
import com.mobiledevmcp.demo.mcp.MCPBridge
import com.mobiledevmcp.demo.viewmodel.AppState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    state: AppState,
    onLogin: () -> Unit,
    onLogout: () -> Unit,
    onProductClick: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // MCP SDK Status (Development only) - at top for visibility
        if (BuildConfig.DEBUG) {
            item {
                MCPStatusCard()
            }
        }
        
        // Welcome Banner
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text(
                        text = "Welcome${state.currentUser?.let { ", ${it.name}" } ?: ""}!",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Discover amazing products",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                }
            }
        }
        
        // Quick Actions
        item {
            Text(
                text = "Quick Actions",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                QuickActionCard(
                    icon = Icons.Default.ShoppingBag,
                    title = "Products",
                    modifier = Modifier.weight(1f),
                    onClick = onProductClick
                )
                QuickActionCard(
                    icon = Icons.Default.ShoppingCart,
                    title = "Cart",
                    modifier = Modifier.weight(1f),
                    onClick = { }
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                QuickActionCard(
                    icon = Icons.Default.LocalShipping,
                    title = "Orders",
                    modifier = Modifier.weight(1f),
                    onClick = { }
                )
                QuickActionCard(
                    icon = Icons.Default.Settings,
                    title = "Settings",
                    modifier = Modifier.weight(1f),
                    onClick = { }
                )
            }
        }
        
        // Cart Summary (if has items)
        if (state.cartItemCount > 0) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Cart Summary",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "${state.cartItemCount} item(s) in cart",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Text(
                            text = "Total: $${String.format("%.2f", state.cartTotal)}",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun MCPStatusCard() {
    val isConnected by MCPBridge.isConnected.collectAsState()
    val lastActivity by MCPBridge.lastActivity.collectAsState()
    val reconnectCount by MCPBridge.reconnectCount.collectAsState()
    var showActivityLog by remember { mutableStateOf(false) }
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                color = if (isConnected) Color(0xFF4CAF50) else MaterialTheme.colorScheme.tertiary,
                shape = RoundedCornerShape(12.dp)
            ),
        colors = CardDefaults.cardColors(
            containerColor = if (isConnected) 
                Color(0xFF4CAF50).copy(alpha = 0.1f)
            else 
                MaterialTheme.colorScheme.tertiaryContainer
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header row
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(
                    Icons.Default.Build,
                    contentDescription = null,
                    tint = if (isConnected) Color(0xFF4CAF50) else MaterialTheme.colorScheme.tertiary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "MCP SDK",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = if (isConnected) Color(0xFF4CAF50) else MaterialTheme.colorScheme.tertiary
                )
                Spacer(modifier = Modifier.weight(1f))
                
                // Connection indicator with reconnect count
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(if (isConnected) Color(0xFF4CAF50) else Color(0xFFF44336))
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (isConnected) "Connected" else "Disconnected",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )
                    if (reconnectCount > 0 && !isConnected) {
                        Text(
                            text = " ($reconnectCount)",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFFFF9800)
                        )
                    }
                }
            }
            
            // Last activity
            if (lastActivity.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = lastActivity,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                    maxLines = 1
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Server: ws://10.0.2.2:8765",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
            
            // Action buttons
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = { MCPBridge.reconnect() },
                    enabled = !isConnected,
                    modifier = Modifier.height(32.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Icon(
                        Icons.Default.Refresh,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Reconnect", style = MaterialTheme.typography.labelSmall)
                }
                
                OutlinedButton(
                    onClick = { showActivityLog = true },
                    modifier = Modifier.height(32.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Icon(
                        Icons.Default.List,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Activity Log", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
    
    // Activity Log Dialog
    if (showActivityLog) {
        MCPActivityLogDialog(onDismiss = { showActivityLog = false })
    }
}

@Composable
fun MCPActivityLogDialog(onDismiss: () -> Unit) {
    val isConnected by MCPBridge.isConnected.collectAsState()
    val reconnectCount by MCPBridge.reconnectCount.collectAsState()
    val activityLog = remember { MCPBridge.getActivityLog() }
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("MCP SDK Activity") },
        text = {
            Column {
                // Status row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Status:", style = MaterialTheme.typography.bodyMedium)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(if (isConnected) Color(0xFF4CAF50) else Color(0xFFF44336))
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            if (isConnected) "Connected" else "Disconnected",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
                
                if (reconnectCount > 0) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Reconnect Attempts:", style = MaterialTheme.typography.bodyMedium)
                        Text(
                            "$reconnectCount",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFFFF9800)
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(12.dp))
                Text("Activity Log:", style = MaterialTheme.typography.titleSmall)
                Spacer(modifier = Modifier.height(8.dp))
                
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp))
                        .padding(8.dp)
                ) {
                    if (activityLog.isEmpty()) {
                        Text(
                            "No activity yet",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                        )
                    } else {
                        LazyColumn {
                            items(activityLog.reversed()) { entry ->
                                Text(
                                    text = entry,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = when {
                                        entry.contains("Error") || entry.contains("failed") -> Color(0xFFF44336)
                                        entry.contains("Connected!") -> Color(0xFF4CAF50)
                                        entry.contains("Command") -> Color(0xFF2196F3)
                                        entry.contains("Response") -> Color(0xFF9C27B0)
                                        else -> MaterialTheme.colorScheme.onSurface
                                    },
                                    modifier = Modifier.padding(vertical = 2.dp)
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        }
    )
}

@Composable
fun QuickActionCard(
    icon: ImageVector,
    title: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier.clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                icon,
                contentDescription = null,
                modifier = Modifier.size(32.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
