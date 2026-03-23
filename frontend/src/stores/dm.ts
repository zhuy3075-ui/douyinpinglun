import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { BrowserProfile, DMTask, DMConfig, DMStatus } from '../types'
import * as App from '../wailsjs/go/main/App'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'

export const useDMStore = defineStore('dm', () => {
  // State
  const accounts = ref<BrowserProfile[]>([])
  const tasks = ref<DMTask[]>([])
  const config = ref<DMConfig>({
    template_path: '',
    min_interval_sec: 60,
    daily_limit_per_account: 100,
    daily_limit_total: 500,
    concurrency: 3,
    auto_add_to_monitor: true,
    new_video_only: false,
  })
  const dmStatus = ref<DMStatus>({
    engine_running: false,
    today_success: 0,
    today_failed: 0,
  })
  const loading = ref(false)
  const configSaving = ref(false)

  // Computed
  const onlineAccounts = computed(() =>
    accounts.value.filter(a => a.cookie_status === 'valid' && a.enabled)
  )

  const pendingTaskCount = computed(() =>
    tasks.value.filter(t => t.status === 'pending').length
  )

  const successTaskCount = computed(() =>
    tasks.value.filter(t => t.status === 'success').length
  )

  const failedTaskCount = computed(() =>
    tasks.value.filter(t => t.status === 'failed' || t.status === 'blocked').length
  )

  // Actions
  async function fetchAll() {
    loading.value = true
    try {
      const [accs, taskList, cfg, st] = await Promise.all([
        App.GetAccounts(),
        App.GetDMTasks(),
        App.GetDMConfig(),
        App.GetDMStatus(),
      ])
      accounts.value = accs
      tasks.value = taskList
      config.value = cfg
      dmStatus.value = st
    } catch (e) {
      console.error('DM fetchAll failed:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchAccounts() {
    try {
      accounts.value = await App.GetAccounts()
    } catch (e) {
      console.error('GetAccounts failed:', e)
    }
  }

  async function fetchTasks() {
    try {
      tasks.value = await App.GetDMTasks()
    } catch (e) {
      console.error('GetDMTasks failed:', e)
    }
  }

  async function fetchStatus() {
    try {
      dmStatus.value = await App.GetDMStatus()
    } catch (e) {
      console.error('GetDMStatus failed:', e)
    }
  }

  async function startEngine() {
    try {
      await App.StartDMEngine()
      await fetchStatus()
    } catch (e) {
      console.error('StartDMEngine failed:', e)
      throw e
    }
  }

  async function stopEngine() {
    try {
      await App.StopDMEngine()
      await fetchStatus()
    } catch (e) {
      console.error('StopDMEngine failed:', e)
      throw e
    }
  }

  async function addAccount(profileId: string) {
    try {
      await App.AddAccount(profileId)
      await fetchAccounts()
    } catch (e) {
      console.error('AddAccount failed:', e)
      throw e
    }
  }

  async function deleteAccount(profileId: string) {
    try {
      await App.DeleteAccount(profileId)
      accounts.value = accounts.value.filter(a => a.profile_id !== profileId)
    } catch (e) {
      console.error('DeleteAccount failed:', e)
      throw e
    }
  }

  async function extractAccountInfo(profileId: string) {
    try {
      await App.ExtractAccountInfo(profileId)
      await fetchAccounts()
    } catch (e) {
      console.error('ExtractAccountInfo failed:', e)
      throw e
    }
  }

  async function testSendDM(profileId: string, targetUID: string) {
    try {
      await App.TestSendDM(profileId, targetUID)
    } catch (e) {
      console.error('TestSendDM failed:', e)
      throw e
    }
  }

  async function saveConfig() {
    configSaving.value = true
    try {
      await App.SaveDMConfig(config.value)
    } catch (e) {
      console.error('SaveDMConfig failed:', e)
      throw e
    } finally {
      configSaving.value = false
    }
  }

  function clearCompletedTasks() {
    tasks.value = tasks.value.filter(
      t => t.status !== 'success' && t.status !== 'failed' && t.status !== 'blocked'
    )
  }

  function setupEventListeners() {
    EventsOn('dm:task-update', (updatedTask: DMTask) => {
      const idx = tasks.value.findIndex(t => t.task_id === updatedTask.task_id)
      if (idx >= 0) {
        tasks.value[idx] = updatedTask
      } else {
        tasks.value.unshift(updatedTask)
      }
    })

    EventsOn('dm:stats-update', (stats: DMStatus) => {
      dmStatus.value = stats
    })

    EventsOn('cookie:expired', (profileId: string) => {
      const acc = accounts.value.find(a => a.profile_id === profileId)
      if (acc) {
        acc.cookie_status = 'expired'
        acc.enabled = false
      }
    })
  }

  function teardownEventListeners() {
    EventsOff('dm:task-update')
    EventsOff('dm:stats-update')
    EventsOff('cookie:expired')
  }

  return {
    accounts,
    tasks,
    config,
    dmStatus,
    loading,
    configSaving,
    onlineAccounts,
    pendingTaskCount,
    successTaskCount,
    failedTaskCount,
    fetchAll,
    fetchAccounts,
    fetchTasks,
    fetchStatus,
    startEngine,
    stopEngine,
    addAccount,
    deleteAccount,
    extractAccountInfo,
    testSendDM,
    saveConfig,
    clearCompletedTasks,
    setupEventListeners,
    teardownEventListeners,
  }
})
