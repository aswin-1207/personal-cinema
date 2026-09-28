// ImportView.swift - Personal Cinema Universal Importer Screen (Local-First)
import SwiftUI
import UniformTypeIdentifiers
import PhotosUI

struct ImportView: View {
    @State private var viewModel = ImportViewModel()
    @State private var showingFilePicker = false
    @State private var showingClipboard = false
    @State private var clipboardText = ""

    var body: some View {
        ZStack {
            Color.cinemaBlack.ignoresSafeArea()

            switch viewModel.step {
            case .idle:
                idleView
            case .processing:
                processingView
            case .review:
                reviewView
            case .committing:
                committingView
            case .done:
                doneView
            }
        }
        .navigationTitle("Import Movie List")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .fileImporter(
            isPresented: $showingFilePicker,
            allowedContentTypes: [.plainText, .commaSeparatedText, .tabSeparatedText],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                if let url = urls.first {
                    Task { await viewModel.processFile(url: url) }
                }
            case .failure(let error):
                viewModel.errorMessage = error.localizedDescription
            }
        }
        .sheet(isPresented: $showingClipboard) {
            clipboardSheet
        }
    }

    private var idleView: some View {
        ScrollView {
            VStack(spacing: CinemaSpacing.lg) {
                // Import method cards
                VStack(alignment: .leading, spacing: CinemaSpacing.md) {
                    Text("SELECT IMPORT SOURCE")
                        .font(.cinemaLabel)
                        .foregroundColor(.cinemaSubtle)
                        .kerning(1.5)

                    importMethodCard(
                        icon: "doc.text.fill",
                        title: "Import from CSV or TXT",
                        subtitle: "Spreadsheets or plain text lists of movie titles"
                    ) {
                        showingFilePicker = true
                    }

                    importMethodCard(
                        icon: "doc.on.clipboard",
                        title: "Paste from Clipboard / Text",
                        subtitle: "Paste a list of titles (e.g. from notes, Letterboxd, or text)"
                    ) {
                        clipboardText = UIPasteboard.general.string ?? ""
                        showingClipboard = true
                    }
                }

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.cinemaCaption)
                        .foregroundColor(.cinemaCrimsonSoft)
                        .padding(CinemaSpacing.md)
                        .background(Color.cinemaCrimson.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.sm))
                }

                Spacer(minLength: CinemaSpacing.xxl)
            }
            .padding(CinemaSpacing.md)
        }
    }

    @ViewBuilder
    private func importMethodCard(icon: String, title: String, subtitle: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: CinemaSpacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 26))
                    .foregroundColor(.cinemaGold)
                    .frame(width: 36)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.cinemaBodyMedium)
                        .foregroundColor(.cinemaWhite)
                    Text(subtitle)
                        .font(.cinemaCaption)
                        .foregroundColor(.cinemaSubtle)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .foregroundColor(.cinemaSubtle)
            }
            .padding(CinemaSpacing.md)
            .cinemaCard()
        }
        .buttonStyle(.plain)
    }

    private var processingView: some View {
        VStack(spacing: CinemaSpacing.lg) {
            Spacer()

            ProgressView()
                .progressViewStyle(.circular)
                .scaleEffect(1.6)
                .tint(.cinemaGold)

            VStack(spacing: CinemaSpacing.sm) {
                Text("Matching Movies via TMDB...")
                    .font(.cinemaH3)
                    .foregroundColor(.cinemaWhite)

                Text("Scanning titles, matching metadata, and fetching movie artwork.")
                    .font(.cinemaBody)
                    .foregroundColor(.cinemaSubtle)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, CinemaSpacing.xl)
            }

            Spacer()
        }
    }

    private var reviewView: some View {
        VStack(spacing: 0) {
            // Summary Banner
            HStack {
                VStack(alignment: .leading) {
                    Text("Review Matched Films")
                        .font(.cinemaH3)
                        .foregroundColor(.cinemaWhite)
                    Text("\(viewModel.items.count) films detected")
                        .font(.cinemaCaption)
                        .foregroundColor(.cinemaSubtle)
                }
                Spacer()
                Button {
                    Task { await viewModel.commitImport(asWatched: false) }
                } label: {
                    Text("Add \(readyCount) to Watchlist")
                        .font(.cinemaBodyMedium)
                        .foregroundColor(.cinemaBlack)
                        .padding(.horizontal, CinemaSpacing.md)
                        .padding(.vertical, CinemaSpacing.sm)
                        .background(Color.cinemaGold)
                        .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
                }
            }
            .padding(CinemaSpacing.md)
            .background(Color.cinemaSurface)

            List {
                ForEach(viewModel.items) { item in
                    importItemRow(item: item)
                        .listRowBackground(Color.cinemaCharcoal)
                        .listRowSeparatorTint(Color.white.opacity(0.06))
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
    }

    @ViewBuilder
    private func importItemRow(item: ImportItem) -> some View {
        HStack(spacing: CinemaSpacing.md) {
            Circle()
                .fill(statusColor(item.status))
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: CinemaSpacing.xs) {
                Text(item.rawText)
                    .font(.cinemaCaption)
                    .foregroundColor(.cinemaSubtle)
                    .lineLimit(1)

                if let movie = item.matchedMovie {
                    HStack(spacing: CinemaSpacing.xs) {
                        AsyncImage(url: movie.posterURL) { image in
                            image.resizable().aspectRatio(contentMode: .fill)
                        } placeholder: {
                            Color.cinemaCharcoal
                        }
                        .frame(width: 32, height: 48)
                        .clipShape(RoundedRectangle(cornerRadius: 4))

                        VStack(alignment: .leading) {
                            Text(movie.title)
                                .font(.cinemaCaptionMedium)
                                .foregroundColor(.cinemaWhite)
                                .lineLimit(1)
                            if let year = movie.releaseYear {
                                Text(year).font(.cinemaLabel).foregroundColor(.cinemaSubtle)
                            }
                        }
                    }
                } else {
                    Text("No TMDB match found")
                        .font(.cinemaCaption)
                        .foregroundColor(.cinemaCrimsonSoft)
                }
            }

            Spacer()
        }
        .padding(.vertical, CinemaSpacing.xs)
    }

    private var committingView: some View {
        VStack(spacing: CinemaSpacing.lg) {
            Spacer()
            ProgressView().tint(.cinemaGold).scaleEffect(1.6)
            Text("Saving Films to Local Archive...")
                .font(.cinemaH3).foregroundColor(.cinemaWhite)
            Spacer()
        }
    }

    private var doneView: some View {
        VStack(spacing: CinemaSpacing.xl) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80, weight: .thin))
                .foregroundColor(.cinemaGold)

            VStack(spacing: CinemaSpacing.sm) {
                Text("Import Complete!")
                    .font(.cinemaH1).foregroundColor(.cinemaWhite)
                Text("\(viewModel.committedCount) films have been added to your local library.")
                    .font(.cinemaBody).foregroundColor(.cinemaSubtle)
                    .multilineTextAlignment(.center)
            }

            Spacer()

            Button { viewModel.reset() } label: {
                Text("Import Another List")
                    .frame(maxWidth: .infinity).frame(height: 52)
            }
            .buttonStyle(CinemaButtonStyle(variant: .secondary))
            .padding(.horizontal, CinemaSpacing.md)
            .padding(.bottom, CinemaSpacing.xxxl)
        }
    }

    private var clipboardSheet: some View {
        NavigationStack {
            ZStack {
                Color.cinemaBlack.ignoresSafeArea()
                VStack(spacing: CinemaSpacing.lg) {
                    Text("Paste your movie list below. Formats like 'Inception (2010)' or bullet points are supported.")
                        .font(.cinemaBody)
                        .foregroundColor(.cinemaSubtle)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, CinemaSpacing.md)

                    TextEditor(text: $clipboardText)
                        .foregroundColor(.cinemaWhite)
                        .tint(.cinemaGold)
                        .padding(CinemaSpacing.md)
                        .background(Color.cinemaSurface)
                        .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
                        .colorScheme(.dark)
                        .frame(minHeight: 200)
                        .padding(.horizontal, CinemaSpacing.md)

                    Button {
                        let text = clipboardText
                        showingClipboard = false
                        Task { await viewModel.processText(text) }
                    } label: {
                        Text("PROCESS MOVIE LIST")
                            .kerning(1.5)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                    }
                    .buttonStyle(CinemaButtonStyle(variant: .primary))
                    .disabled(clipboardText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .padding(.horizontal, CinemaSpacing.md)

                    Spacer()
                }
                .padding(.top, CinemaSpacing.md)
            }
            .navigationTitle("Import from Text")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingClipboard = false }.foregroundColor(.cinemaGold)
                }
            }
        }
    }

    private var readyCount: Int {
        viewModel.items.filter { $0.status == .matched || $0.status == .needsReview }.count
    }

    private func statusColor(_ status: ImportItemStatus) -> Color {
        switch status {
        case .matched: return .cinemaGold
        case .needsReview: return Color.yellow
        case .noMatch: return .cinemaCrimsonSoft
        }
    }
}
