.class public Lcom/iRetardgram/IRetardHooks;
.super Ljava/lang/Object;

# iRetardgram Network Hooks
# Intercepts network requests and blocks unwanted content
#
# Blocked endpoints (path unless noted):
#   - /feed/timeline/ (home feed posts - Stories load from /feed/reels_tray/ separately)
#   - /discover/topical_explore (explore content)
#   - /clips/discover (reels discovery)
#   - /api/v1/clips/user/, /api/v1/clips/multi_user/ (reels and blend aggregation)
#   - /api/v1/feed/reels_media/ (reels media stream)
#   - /blend and /blends (Blend surfaces and blend-driven endless reels/feed)
#   - /api/v1/qe/sync/, /api/v1/launcher/sync/ (feature flags / rollout)
#   - /api/v1/direct_v2/threads/get_by_participants/ (blend session lookup)
#   - /api/v1/reels/liked/, /api/v1/discover/explore (reels/explore ranking signals)
#   - /logging/ (client event logging)
#   - /async_ads_privacy/ (ad tracking)
#   - /async_critical_notices/ (engagement nudge analytics)
#   - /api/v1/media/.../seen/ ("seen" tracking for posts)
#   - /api/v1/fbupload/ (telemetry upload)
#   - /api/v1/stats/ (performance/usage stats)
#   - /api/v1/loom/, /api/v1/analytics/ (internal tracing / analytics)
#   - /api/v1/commerce/, /api/v1/shopping/, /api/v1/sellable_items/ (shopping preloads)
#
# Note: /clips/home/ is NOT blocked because the Reels tab is already
#       redirected at the UI level - users can still view reels shared in DMs


.method public constructor <init>()V
    .locals 0
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    return-void
.end method


# Log a message with tag "iRetardgram" (visible via: adb logcat -s "iRetardgram:D")
.method public static log(Ljava/lang/String;)V
    .locals 1
    const-string v0, "iRetardgram"
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
    
    invoke-static {v0}, Lcom/iRetardgram/IRetardHooks;->log(Ljava/lang/String;)V
    
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
    invoke-static {p0}, Lcom/iRetardgram/IRetardHooks;->logRequest(Ljava/net/URI;)V

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

    # Block reels user feed
    const-string v1, "/api/v1/clips/user/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Block blend aggregation endpoint
    const-string v1, "/api/v1/clips/multi_user/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Block reels media stream
    const-string v1, "/api/v1/feed/reels_media/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Block Blend surfaces (includes person/group blend reels/feed)
    const-string v1, "/blend"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    const-string v1, "/blends"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Block feature-flag sync that can re-enable blend-like experiences
    const-string v1, "/api/v1/qe/sync/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    const-string v1, "/api/v1/launcher/sync/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Block blend session lookup while preserving general DM threads/inbox
    const-string v1, "/api/v1/direct_v2/threads/get_by_participants/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    # Block additional reels/explore preference signals
    const-string v1, "/api/v1/reels/liked/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    const-string v1, "/api/v1/discover/explore/"
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
    invoke-static {v0}, Lcom/iRetardgram/IRetardHooks;->shouldBlockMediaSeen(Ljava/lang/String;)Z
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

    # Internal tracing and analytics
    const-string v1, "/api/v1/loom/"
    invoke-virtual {v0, v1}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v2
    if-nez v2, :cond_block

    const-string v1, "/api/v1/analytics/"
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
    invoke-static {v1}, Lcom/iRetardgram/IRetardHooks;->log(Ljava/lang/String;)V
    
    new-instance v3, Ljava/io/IOException;
    const-string v1, "Blocked by iRetardgram"
    invoke-direct {v3, v1}, Ljava/io/IOException;-><init>(Ljava/lang/String;)V
    throw v3

.end method

