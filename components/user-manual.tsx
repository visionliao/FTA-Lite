"use client"

import { Label } from "@/components/ui/label"

export function UserManual() {
  return (
    <div className="p-4 md:p-8 max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto">
      <div className="mb-6 border-b border-border pb-4 md:mb-8">
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">使用手册</h1>
      </div>

      <div className="space-y-8">
        {/* Introduction */}
        <section className="space-y-4">
          <div>
            <Label className="text-base font-medium text-foreground">简介</Label>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              欢迎使用 Factory Test Agent！这是一个AI项目的工厂测试工具，帮助您自动化测试AI产品，在提交代码到生产环境之前，通过这个自动化测试程序全面跑一次问题集，可以有效的判断风险、找出异常原因，使最终交付项目达到最优状态。
            </p>
          </div>
        </section>

        {/* Quick Start */}
        <section className="space-y-4 pt-6 border-t border-border">
          <div>
            <Label className="text-base font-medium text-foreground">快速开始</Label>
            <div className="mt-4 space-y-3">
              <div className="p-4 bg-muted/20 rounded-lg border border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">1. 创建项目</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  "项目配置"页面，包含了系统提示词、知识库文件和MCP工具的信息。
                  <div className="pl-4">
                    项目名称：无特定格式，只是用来作为持久化项目配置的存储目录。
                  </div>
                  <div className="pl-4">
                    系统提示词：真实的项目运行时发送给大模型的系统提示词。
                  </div>
                  <div className="pl-4">
                    知识库：本地知识库文件，可系统提示词一样，输入真实项目运行的知识库文件，尽量使测试环境和生产环境一致。后续会支持本地数据库。
                  </div>
                  <div className="pl-4">
                    MCP工具：现代AI应用几乎都需要通过MCP来扩展大模型的智能，输入MCP服务器的地址，让测试环境可以调用MCP工具。
                  </div>
                </p>
              </div>
              <div className="p-4 bg-muted/20 rounded-lg border border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">2. 配置模型</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  在"模型设置"页面中，选择 AI 模型并调整参数，如温度、最大令牌数等。
                  <div className="pl-4">
                    工作模型：用来将测试题集中的问题发送给大模型并得到回复的模型，将其配置的和生产环境中使用的模型一致。
                  </div>
                  <div className="pl-4">
                    评分模型：用来对比大模型的回复和标准答案进行评分判定的模型，根据env中配置的支持模型列表，尽量设置为推理性较强的模型，以获得一个公正的裁判。
                  </div>
                </p>
              </div>
              <div className="p-4 bg-muted/20 rounded-lg border border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">3. 测试题集</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  "测试题集"页面包含所有需要测试评测的问题集合，因为这些数据都会持久化，本身也是问题收集的一种手段，随着项目的迭代，问题集理论上会越来越多。为了让项目获得一个正向迭代，应该确保这些所有的历史问题都测试通过，这也是FTA工具的价值所在。
                  <div className="pl-4">
                    点击新增问题按钮来扩展问题集，问题集保存在项目的template/questions/test_cases.json文件中，您也可以直接编辑这个json文件来扩展问题集。
                  </div>
                </p>
              </div>
              <div className="p-4 bg-muted/20 rounded-lg border border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">4. 开始运行</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  在"开始运行"页面中，可以配置测试循环次数，默认1次既不循环测试，也就意味着将问题集中所有的问题都测试一次即结束。
                  <div className="pl-4">
                    点击开始运行按钮，进入自动化测试流程，面板中可以看到当前的测试进度，以及当前进度的详细情况。
                  </div>
                </p>
              </div>
              <div className="p-4 bg-muted/20 rounded-lg border border-border">
                <h3 className="text-sm font-medium text-foreground mb-2">5. 测试报告</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  在"测试报告"页面中，查看历史测试记录的测试报告。每个测试问题用红色、黄色、绿色背景来标识。
                  <div className="pl-4">
                    红色背景：优先显示的测试项，表示评分低于6分的问题，这通常代表严重问题，和预期答案完全不相符，应该排查系统提示词、知识库、MCP工具调用链等环节。
                  </div>
                  <div className="pl-4">
                    黄色背景：次要显示优先级，显示在红色背景问题的下方，表示评分为6-7分的问题，大体上和标准答案一致，但有差异，属于警告信息。
                  </div>
                  <div className="pl-4">
                    绿色背景：最低显示优先级，显示在最下方，表示评分大于等于8分的问题，这几乎是没有问题的测试通过的项，可以不用关注。
                  </div>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="space-y-4 pt-6 border-t border-border">
          <div>
            <Label className="text-base font-medium text-foreground">主要功能</Label>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-sm text-foreground">•</span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">项目级配置持久化：</strong>为每个AI应用创建独立项目，持久化管理系统提示词、知识库和MCP工具配置。
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-foreground">•</span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">分离式模型设置：</strong>可独立配置“工作模型”与“评分模型”，确保测试环境与生产环境一致的同时，使用最强的模型进行公正评分。
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-foreground">•</span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">迭代式题集管理：</strong>轻松新增、编辑和管理测试问题集，所有历史问题都会被保留，确保新版本迭代不会破坏旧有功能。
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-foreground">•</span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">自动化循环测试：</strong>支持配置测试循环次数，对问题集进行多轮自动化测试，有效评估大模型输出的稳定性。
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm text-foreground">•</span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">可视化测试报告：</strong>通过颜色（红/黄/绿）直观区分问题严重等级，快速定位和分析高风险测试项，并提供详细的得分与耗时数据。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Tips */}
        <section className="space-y-4 pt-6 border-t border-border">
          <div>
            <Label className="text-base font-medium text-foreground">使用技巧</Label>
            <div className="mt-4 space-y-3">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-foreground leading-relaxed">
                  💡 <strong>环境一致性是关键：</strong>为了让测试结果有意义，请确保“项目配置”中的系统提示词、知识库文件以及“模型设置”中的工作模型，都与您最终的生产环境保持一致。
                </p>
              </div>
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-foreground leading-relaxed">
                  💡 <strong>优先解决红色问题：</strong>在查看测试报告时，应最优先关注得分低于6分的红色背景问题。它们通常指向系统提示词、知识库或MCP工具调用链中的严重缺陷。
                </p>
              </div>
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-foreground leading-relaxed">
                  💡 <strong>利用JSON文件批量管理：</strong>当问题集变得庞大时，直接在IDE中编辑项目下的 `template/questions/test_cases.json` 文件，会比在界面上逐条新增问题更高效。
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
