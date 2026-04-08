.class public Lcom/feurstagram/FeurHooks;
.super Ljava/lang/Object;

# Feurstagram Network Hooks
# Intercepts network requests and blocks unwanted content
#
# Blocked endpoints (path unless noted):
#   - /feed/timeline/ (home feed posts — Stories load from /feed/reels_tray/ separately)
#   - /discover/topical_explore (explore content)
#   - /clips/discover (reels discovery)
#   - /logging/ (client event logging)
#   - /async_ads_privacy/ (ad tracking)
#   - /async_critical_notices/ (engagement nudge analytics)
#   - /api/v1/media/.../seen/ ("seen" tracking for posts)
#   - /api/v1/fbupload/ (telemetry upload)
#   - /api/v1/stats/ (performance/usage stats)
#   - /api/v1/commerce/, /api/v1/shopping/, /api/v1/sellable_items/ (shopping preloads)
#
# Note: /clips/home/ is NOT blocked because the Reels tab is already
#       redirected at the UI level - users can still view reels shared in DMs


.method public constructor <init>()V
    .locals 0
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    return-void
.end method


# Log a message with tag "Feurstagram" (visible via: adb logcat -s "Feurstagram:D")
.method public static log(Ljava/lang/String;)V
    .locals 1
    const-string v0, "Feurstagram"
    invoke-static {v0, p0}, Landroid/util/Log;->d(Ljava/lang/String;Ljava/lang/String;)I
    return-void
.end method


# Log network request URL for debugging
.method public static logRequest(Ljava/net/URI;)V
    .locals 3
    
    if-eqz p0, :cond_return
    
    new-instance v0, Ljava/lang/StringBuilder;
    invoke-direct {v0}, Ljava/lang/StringBuilder;-><init>()V
    
    const-string v1, "REQ: "
    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    
    invoke-virtual {p0}, Ljava/net/URI;->getPath()Ljava/lang/String;
    move-result-object v1
    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    
    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
    move-result-object v0
    
    invoke-static {v0}, Lcom/feurstagram/FeurHooks;->log(Ljava/lang/String;)V
    
    :cond_return
    return-void
.end method


# True when path matches /api/v1/media/.../seen/ (post "seen" tracking).
.method private static shouldBlockMediaSeen(Ljava/lang/String;)Z
    .locals 2

    if-eqz p0, :cond_false

    const-string v0, "/api/v1/media/"
    invoke-virtual {p0, v0}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v1
    if-eqz v1, :cond_false

    const-string v0, "/seen"
    invoke-virtual {p0, v0}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v1
    if-nez v1, :cond_true

    :cond_false
    const/4 v0, 0x0
    return v0

    :cond_true
    const/4 v0, 0x1
    return v0
.end method


# Main hook: Throws IOException if request should be blocked
# Called from TigonServiceLayer before each network request
.method public static throwIfBlocked(Ljava/net/URI;)V
    .locals 4

    # Log the request (comment out for production)
    invoke-static {p0}, Lcom/feurstagram/FeurHooks;->logRequest(Ljava/net/URI;)V

    invoke-virtual {p0}, Ljava/net/URI;->getPath()Ljava/lang/String;
    move-result-object v0

    if-eqz v0, :cond_return

    # Block feed timeline (posts) - Stories load separately from /feed/reels_tray/
    const-string v1, "/feed/timeline/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Optionally block Stories
    #const-string v1, "/feed/reels_tray"
    #invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    #move-result v2
    #if-nez v2, :cond_block

    # Block explore content
    const-string v1, "/discover/topical_explore"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Block reels discovery
    const-string v1, "/clips/discover"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Client event logging
    const-string v1, "/logging/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Ad / privacy tracking pings
    const-string v1, "/async_ads_privacy/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Engagement nudge analytics
    const-string v1, "/async_critical_notices/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Post "seen" tracking
    invoke-static {v0}, Lcom/feurstagram/FeurHooks;->shouldBlockMediaSeen(Ljava/lang/String;)Z
    move-result v2
    if-nez v2, :cond_block

    # Facebook telemetry upload
    const-string v1, "/api/v1/fbupload/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Performance / usage stats
    const-string v1, "/api/v1/stats/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Shopping / commerce preloads
    const-string v1, "/api/v1/commerce/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    const-string v1, "/api/v1/shopping/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    const-string v1, "/api/v1/sellable_items/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Not blocked, return normally
    :cond_return
    return-void

    # Block by throwing IOException
    :cond_block
    const-string v1, "BLOCKED!"
    invoke-static {v1}, Lcom/feurstagram/FeurHooks;->log(Ljava/lang/String;)V
    
    new-instance v3, Ljava/io/IOException;
    const-string v1, "Blocked by Feurstagram"
    invoke-direct {v3, v1}, Ljava/io/IOException;-><init>(Ljava/lang/String;)V
    throw v3

.end method
