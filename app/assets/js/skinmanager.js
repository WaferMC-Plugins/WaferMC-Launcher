const { pathToFileURL } = require('url')

const DEFAULT_SKIN_ID = '__default__'
const LOGO_FALLBACK = 'assets/images/WaferMCLogo.png'
const VALID_SKIN_TYPES = ['file', 'username', 'url']

function sanitizeString(value){
    return typeof value === 'string' ? value.trim() : ''
}

function normalizeUUID(uuid){
    return sanitizeString(uuid).replace(/-/g, '')
}

function sanitizeSkinEntry(entry){
    if(entry == null || typeof entry !== 'object'){
        return null
    }

    const id = sanitizeString(entry.id)
    const type = sanitizeString(entry.type).toLowerCase()
    const value = sanitizeString(entry.value)

    if(id.length === 0 || VALID_SKIN_TYPES.indexOf(type) === -1 || value.length === 0){
        return null
    }

    const normalized = {
        id,
        type,
        value,
        label: sanitizeString(entry.label) || value
    }

    if(type === 'file'){
        const filePath = sanitizeString(entry.path)
        if(filePath.length === 0){
            return null
        }
        normalized.path = filePath
    }

    if(Number.isFinite(entry.createdAt)){
        normalized.createdAt = Number(entry.createdAt)
    }

    return normalized
}

function getSkinEntries(account){
    if(account == null || typeof account !== 'object'){
        return []
    }

    const source = Array.isArray(account.customSkins) ? account.customSkins : []
    const seen = new Set()
    const normalized = []

    for(const raw of source){
        const entry = sanitizeSkinEntry(raw)
        if(entry != null && !seen.has(entry.id)){
            seen.add(entry.id)
            normalized.push(entry)
        }
    }

    return normalized
}

function getSelectedSkinId(account){
    const selected = sanitizeString(account?.selectedSkinId)
    return selected.length > 0 ? selected : null
}

function getSelectedSkinEntry(account){
    const selectedId = getSelectedSkinId(account)
    if(selectedId == null){
        return null
    }

    const entries = getSkinEntries(account)
    const selected = entries.find((entry) => entry.id === selectedId)
    return selected || null
}

function isLikelyHTTPUrl(value){
    const resolved = sanitizeString(value)
    if(resolved.length === 0){
        return false
    }

    try {
        const parsed = new URL(resolved)
        return parsed.protocol === 'https:' || parsed.protocol === 'http:'
    } catch(_err){
        return false
    }
}

function isLikelyValidUsername(value){
    return /^[a-zA-Z0-9_]{1,16}$/.test(sanitizeString(value))
}

function resolveEntryAvatarCandidates(entry, size = 128){
    const resolvedSize = Number.isFinite(size) && size > 0 ? Math.trunc(size) : 128
    if(entry == null){
        return []
    }

    if(entry.type === 'file'){
        try {
            return [pathToFileURL(entry.path).href]
        } catch(_err){
            return []
        }
    }

    if(entry.type === 'username'){
        const username = encodeURIComponent(entry.value)
        return [
            `https://mc-heads.net/avatar/${username}/${resolvedSize}`,
            `https://visage.surgeplay.com/bust/${resolvedSize}/${username}`,
            `https://minotar.net/avatar/${username}/${resolvedSize}`
        ]
    }

    if(entry.type === 'url' && isLikelyHTTPUrl(entry.value)){
        return [entry.value]
    }

    return []
}

function resolveDefaultAvatarCandidates(account, size = 128){
    const resolvedSize = Number.isFinite(size) && size > 0 ? Math.trunc(size) : 128
    const normalizedUUID = normalizeUUID(account?.uuid)
    const normalizedName = encodeURIComponent(sanitizeString(account?.displayName))
    const candidates = []

    if(normalizedUUID.length > 0){
        candidates.push(`https://mc-heads.net/avatar/${normalizedUUID}/${resolvedSize}`)
        candidates.push(`https://crafatar.com/avatars/${normalizedUUID}?overlay=true&size=${resolvedSize}`)
        candidates.push(`https://visage.surgeplay.com/bust/${resolvedSize}/${normalizedUUID}`)
    }

    if(normalizedName.length > 0){
        candidates.push(`https://visage.surgeplay.com/bust/${resolvedSize}/${normalizedName}`)
        candidates.push(`https://mc-heads.net/avatar/${normalizedName}/${resolvedSize}`)
        candidates.push(`https://minotar.net/avatar/${normalizedName}/${resolvedSize}`)
    }

    return candidates
}

function getAccountAvatarCandidates(account, size = 128){
    const selectedSkin = getSelectedSkinEntry(account)
    const selectedCandidates = resolveEntryAvatarCandidates(selectedSkin, size)
    const defaultCandidates = resolveDefaultAvatarCandidates(account, size)
    return selectedCandidates.concat(defaultCandidates)
}

function loadFirstImage(urls){
    return new Promise((resolve) => {
        const dedupedUrls = Array.from(new Set(urls.filter((url) => typeof url === 'string' && url.trim().length > 0)))
        const attemptLoad = (idx) => {
            if(idx >= dedupedUrls.length){
                resolve(null)
                return
            }

            const img = new Image()
            img.onload = () => resolve(dedupedUrls[idx])
            img.onerror = () => attemptLoad(idx + 1)
            img.src = dedupedUrls[idx]
        }

        attemptLoad(0)
    })
}

async function resolveAccountAvatar(account, size = 128){
    const resolved = await loadFirstImage(getAccountAvatarCandidates(account, size))
    return resolved || LOGO_FALLBACK
}

module.exports = {
    DEFAULT_SKIN_ID,
    LOGO_FALLBACK,
    normalizeUUID,
    sanitizeSkinEntry,
    getSkinEntries,
    getSelectedSkinId,
    getSelectedSkinEntry,
    isLikelyHTTPUrl,
    isLikelyValidUsername,
    resolveEntryAvatarCandidates,
    resolveDefaultAvatarCandidates,
    getAccountAvatarCandidates,
    loadFirstImage,
    resolveAccountAvatar
}
