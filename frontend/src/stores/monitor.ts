import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MonitorVideo, Comment, MonitorStatus } from '../types'
import * as App from '../wailsjs/go/main/App'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'

export const useMonitorStore = defineStore('monitor', () => {
  // State
  const videos = ref<MonitorVideo[]>([])
  const comments = ref<Comment[]>([])
  const status = ref<MonitorStatus>({
    running: false,
    current_round: 0,
    new_comments_this_round: 0,
    total_comments: 0,
  })
  const selectedVideoId = ref<string | null>(null)
  const commentMode = ref<'new' | 'all'>('all')
  const searchKeyword = ref('')
  const loading = ref(false)
  const commentLoading = ref(false)

  // Computed
  const filteredVideos = computed(() => {
    if (!searchKeyword.value.trim()) return videos.value
    const kw = searchKeyword.value.toLowerCase()
    return videos.value.filter(
      v => v.title.toLowerCase().includes(kw) || v.author_nickname.toLowerCase().includes(kw)
    )
  })

  const activeVideoCount = computed(() =>
    videos.value.filter(v => v.status === 'active').length
  )

  // Actions
  async function fetchVideos() {
    loading.value = true
    try {
      videos.value = await App.GetVideos()
    } catch (e) {
      console.error('GetVideos failed:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchStatus() {
    try {
      status.value = await App.GetMonitorStatus()
    } catch (e) {
      console.error('GetMonitorStatus failed:', e)
    }
  }

  async function fetchComments(videoId?: string) {
    const vid = videoId || selectedVideoId.value
    if (!vid) return
    commentLoading.value = true
    try {
      comments.value = await App.GetComments(vid, commentMode.value)
    } catch (e) {
      console.error('GetComments failed:', e)
    } finally {
      commentLoading.value = false
    }
  }

  async function startMonitor() {
    try {
      await App.StartMonitor()
      await fetchStatus()
    } catch (e) {
      console.error('StartMonitor failed:', e)
      throw e
    }
  }

  async function stopMonitor() {
    try {
      await App.StopMonitor()
      await fetchStatus()
    } catch (e) {
      console.error('StopMonitor failed:', e)
      throw e
    }
  }

  async function addVideo(url: string) {
    try {
      await App.AddVideo(url)
      await fetchVideos()
    } catch (e) {
      console.error('AddVideo failed:', e)
      throw e
    }
  }

  async function deleteVideo(videoId: string) {
    try {
      await App.DeleteVideo(videoId)
      videos.value = videos.value.filter(v => v.video_id !== videoId)
      if (selectedVideoId.value === videoId) {
        selectedVideoId.value = null
        comments.value = []
      }
    } catch (e) {
      console.error('DeleteVideo failed:', e)
      throw e
    }
  }

  function selectVideo(videoId: string) {
    selectedVideoId.value = videoId
    fetchComments(videoId)
  }

  function setupEventListeners() {
    EventsOn('monitor:status-change', (newStatus: MonitorStatus) => {
      status.value = newStatus
    })

    EventsOn('monitor:new-comments', (newComments: Comment[]) => {
      if (newComments.length > 0) {
        // Prepend new comments, avoid duplicates
        const existingIds = new Set(comments.value.map(c => c.comment_id))
        const fresh = newComments.filter(c => !existingIds.has(c.comment_id))
        if (fresh.length > 0) {
          comments.value = [...fresh, ...comments.value].slice(0, 200)
        }
      }
    })
  }

  function teardownEventListeners() {
    EventsOff('monitor:status-change')
    EventsOff('monitor:new-comments')
  }

  async function init() {
    setupEventListeners()
    await Promise.all([fetchVideos(), fetchStatus()])
  }

  return {
    videos,
    comments,
    status,
    selectedVideoId,
    commentMode,
    searchKeyword,
    loading,
    commentLoading,
    filteredVideos,
    activeVideoCount,
    fetchVideos,
    fetchStatus,
    fetchComments,
    startMonitor,
    stopMonitor,
    addVideo,
    deleteVideo,
    selectVideo,
    setupEventListeners,
    teardownEventListeners,
    init,
  }
})
